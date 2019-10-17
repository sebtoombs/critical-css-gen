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

router.post("/critical", async ctx => {
  const { url, key } = ctx.request.body;
  if (key !== serverKey) {
    ctx.status = 403;
    ctx.body = "Incorrect key";
    return;
  }
  console.log("URL: ", url);

  const [errFetch, html] = await to(fetch(url).then(res => res.buffer()));

  if (errFetch) {
    console.log("Error fetching HTML", errFetch);
    ctx.status = 500;
    ctx.body = errFetch;
    return;
  }

  const [err, output] = await to(
    critical.generate({
      //base: "test/",
      //html: html,
      //src: "html.html",
      folder: url,
      html: html,
      width: 1300,
      height: 900,
      minify: true
    })
  );

  if (err) {
    console.log("Error generating critical CSS", err);
    ctx.status = 500;
    ctx.body = err;
    return;
  }

  console.log("CSS Generated");
  ctx.body = {
    size: getBytes(output),
    css: output
  };
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
