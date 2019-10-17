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

const serverKey = "dbe30568-cae1-4169-a5d2-2a724a6725b1";

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

const endResponse = function*(next) {
  const res = this.res;
  const body = this.body;

  if (res && body) {
    body = JSON.stringify(body);
    this.length = Buffer.byteLength(body);
    res.end(body);
  }

  yield* next;
};

router.get("/test", async ctx => {
  console.log("Testing...");

  const [errFetch, html] = await to(
    fetch("https://salterstest.servercrew.net/" + "?critical_css").then(res =>
      res.buffer()
    )
  );

  if (errFetch) {
    ctx.body = "error";
    console.log("Error", errFetch);
    return;
  }

  const output = await critical.generate({
    base: "test/",
    src: "index.html",
    //folder: "https://salters.com.au/",
    //html: html.toString(),
    width: 1300,
    height: 900,
    inline: true,
    ignore: ["@font-face", /url\(/]
  });

  console.log("output", output.uncritical);
  ctx.body = "ok";
});

router.post("/critical", async (ctx, next) => {
  const { url, key, webhook } = ctx.request.body;
  if (key !== serverKey) {
    ctx.status = 403;
    ctx.body = "Incorrect key";
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
        key: serverKey
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
