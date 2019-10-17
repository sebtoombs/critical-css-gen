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
  const { url } = ctx.request.body;
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
  ctx.body = output;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(8000);

function to(promise) {
  return promise
    .then(data => {
      return [null, data];
    })
    .catch(err => [err]);
}
