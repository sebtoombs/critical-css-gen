const http = require("http");

const Koa = require("koa");
const Router = require("@koa/router");
const cors = require("@koa/cors");

const _ = require("lodash");

const bodyParser = require("koa-bodyparser");

const critical = require("critical");
const fs = require("fs");
const fetch = require("node-fetch");

const app = new Koa();

const PORT = process.env.PORT || 8000;

console.log("Starting server");
console.log("Env: ", process.env.NODE_ENV);
console.log("PORT", PORT);

//Override listen
app.server = http.createServer(app.callback());
app.listen = (...args) => {
  app.server.listen.call(app.server, ...args);
  return app.server;
};

app.use(cors());
app.use(bodyParser());

const router = new Router();

router.get("/ping", ctx => {
  ctx.body = "pong";
});

router.post("/revoke", async ctx => {
  if (!ctx.request.body.key) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: "Missing API Key"
    };
    console.log("Missing API Key");
    return;
  }

  const key = ctx.request.body.key;

  console.log("Key revoked", key);
  ctx.body = { success: true };
});

const validateKey = key => {
  const uuidAPIKey = require("uuid-apikey");
  if (!uuidAPIKey.isAPIKey(key)) {
    console.log("Malformed API Key");
    return [false, "Malformed API Key"];
  }

  //TODO database with valid keys
  const valid_keys = ["0XFCS70-33MMHP4-M13Q0TJ-TJ3M99S"];

  //TODO replace with actual lookup
  if (valid_keys.indexOf(key) === -1) {
    console.log("Invalid API Key");
    return [false, "Invalid API Key"];
  }

  return [true];
};

router.post("/validate", async ctx => {
  console.log("Validating...");

  if (!ctx.request.body.key) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: "Missing API Key"
    };
    console.log("Missing API Key");
    return;
  }

  const keyValidationResponse = validateKey(ctx.request.body.key);
  //TODO store validation in database with URL

  if (!keyValidationResponse[0]) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: keyValidationResponse[1]
    };
    return;
  }

  console.log("Key Validated");
  ctx.body = { success: true };
});

router.get("/api_key", ctx => {
  const uuidAPIKey = require("uuid-apikey");
  const key = uuidAPIKey.create();
  console.log("Created API Key");
  ctx.body = { key: key.apiKey };
});

router.post("/critical", async (ctx, next) => {
  const { url, key, webhook } = ctx.request.body;

  console.log("Critical Request");

  const keyValidationResponse = validateKey(key);
  if (!keyValidationResponse[0]) {
    ctx.status = 403;
    ctx.body = {
      success: false,
      message: keyValidationResponse[1]
    };
    return;
  }
  console.log("URL: ", url);
  ctx.body = "OK";

  ctx.res.end();
  //return next();

  const [errFetch, html] = await to(
    fetch(url + "?critical_css").then(res => res.buffer())
  );

  if (errFetch) {
    console.log("Error fetching HTML", errFetch);
    //ctx.status = 500;
    //ctx.body = errFetch;
    return;
  }

  const [err, output] = await to(
    critical.generate({
      html: html.toString(),
      width: 1300,
      height: 900,
      minify: true,
      ignore: ["@font-face", /url\(/],
      penthouse: {
        puppeteer: {
          args: ["no-sandbox", "disable-setuid-sandbox"]
        }
      }
    })
  );

  if (err) {
    console.log("Error generating critical CSS", err);
    //ctx.status = 500;
    //ctx.body = err;
    return;
  }

  console.log("CSS Generated");

  console.log("Webhook URL: ", webhook);
  //webhook
  const webhookResponse = await fetch(
    //"http://localhost/~sebtoombs/wptest/?critical_css",
    webhook,
    {
      method: "POST",
      body: JSON.stringify({
        css: {
          critical: output.css,
          uncritical: output.uncritical
        },
        //size: getBytes(output),
        url: url,
        key: key
      })
    }
  ).then(res => res.text());

  if (webhookResponse !== "OK") {
    console.log("Webhook failure");
  } else {
    console.log("Webhook posted", webhookResponse);
  }
  /*ctx.body = {
    size: getBytes(output),
    css: output
  };*/
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(PORT);

function to(promise) {
  return promise
    .then(data => {
      return [null, data];
    })
    .catch(err => [err]);
}

function getBytes(string) {
  return Buffer.byteLength(string, "utf8");
}
