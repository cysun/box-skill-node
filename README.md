# Box Skill for Video Analysis Using Azure Media Services

This is a rewrite of [this sample Box Skill](https://github.com/box-community/sample-video-skills/tree/master/microsoft-azure-faces-transcript-topics-detection)
so all credit should go to the original authors. This rewrite does simplify the code and makes it easier to learn and understand.
In particular:

- The code no longer requires AWS, Serverless, TypeScript, or Babel. Now it's just plain old Node.js with a little bit Express.
- We use the more up-to-date @azure/* packages instead of the old azure-* ones, with the exception of azure-storage where the
  API of the new package is rather hard to use (the next release, v12, is supposed to be better).

## Usage

The code can run on any server, though in order to receive requests from Box and Azure, the server must be accessible from
the web. Box in particular is very picky about skill invocation URL -- the server has to use HTTPS, at the default port, with
a certificate from a CA that Box recognizes (it doesn't like the CSULA certificates issued by InCommon, but Let's Encrypt ones
are fine).

Before running the code, copy `.env.sample` to `.env`, and put in your Azure Media Services subscription info. There are
three more parameters you need to configure: `PORT`, `PROXY`, and `ENDPOINT`. Chances are you need to set up a reverse
proxy on your server (i.e. having a web server like NGINX or Apache in front of this application), in which case `PROXY`
should be `true`, and `ENDPOINT` should be the URL used by the outside world to access this application; in other words,
it should be the same as the skill invocation URL you put on Box.

Once the code is running, you can create a Box App then a Box Skill as described in Box documentation.
