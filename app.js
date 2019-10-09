var express = require("express");
var cookieParser = require("cookie-parser");

var prettyjson = require("prettyjson");
var morgan = require("morgan");
morgan.token("body", (req, res) => {
  return "\n" + prettyjson.render(req.body, { noColor: true });
});

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan(":method :url :date[clf] :body", { immediate: true }));

app.all("/", (req, res) => {
  res.json({ message: "hello!" });
});

module.exports = app;
