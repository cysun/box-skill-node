// Set up environment variables
require("dotenv").config();

var prettyjson = require("prettyjson");
var requestLogger = require("morgan");

var express = require("express");

const VideoAnalyzer = require("./video-analyzer");
const { AzureEventsHandler, BoxEvents } = require("./events-handler");
const { FilesReader } = require("./skills-kit-2.0");

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
app.all("/", AzureEventsHandler, async (req, res) => {
  if (BoxEvents.isSkillInvocationEvent(req.body))
    res.status(200).send("Unrecognized request");

  let filesReader = new FilesReader(req.body);
  let videoAnalyzer = new VideoAnalyzer(filesReader.getFileContext());
  await videoAnalyzer.init();
  await videoAnalyzer.createJob();
  res.status(200).send("Event request processed");
});

module.exports = app;
