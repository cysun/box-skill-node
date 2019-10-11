// Set up environment variables
require("dotenv").config();

var prettyjson = require("prettyjson");
var requestLogger = require("morgan");

var express = require("express");

const VideoAnalyzer = require("./ams/video-analyzer");

// Set up request logger
requestLogger.token("body", (req, res) => {
  return "\n" + prettyjson.render(req.body, { noColor: true });
});

// Set up Express
var app = express();
app.set("trust proxy", process.env.PROXY == "true");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  requestLogger(":method :remote-addr :date[clf] :body", { immediate: true })
);

// Handle requests
app.all("/", async (req, res) => {
  var videoAnalyzer = new VideoAnalyzer();
  await videoAnalyzer.init();
  await videoAnalyzer.createJob();
  res.json({ message: "hello!" });
});

module.exports = app;
