#!/usr/local/bin/node

var fs = require("fs");

// Cache lasts three minutes
var CACHE_DURATION = 180 * 1000;
var CACHE_FILE = "/usr/local/var/mbtastatuscache";

// Main entry
if (require.main === module) {
  try {
    fs.stat(CACHE_FILE, function(err, stat) {
      if (err) { return updateCache(); }

      var now = new Date().getTime();
      if (now - stat.ctime.getTime() > CACHE_DURATION) { return updateCache(); }

      fs.readFile(CACHE_FILE, function(err, content) {
        if (err) { throw err; }
        printOutput(content);
      });
    });
  } catch (err) {
    console.log(err);
  }
}

function updateCache() {
  // Get the wifi network name (MacOSX only here)
  var exec = require("child_process").exec;

  exec("networksetup -getairportnetwork en0", function(err, stdout, stderr) {
    // TODO: ip range fallback for wired connections?
    if (err || stderr || stdout.lastIndexOf("Current Wi-Fi Network: ") !== 0) {
      throw new Error("No wifi network access");
    }
    // Strip "Current Wi-Fi Network: " prefix off the output
    var networkName = stdout.slice(23).trim();
    requestMBTAStatus(networkName);
  });
}

function printOutput(content) {
  // Print to stdout and exit
  var data = JSON.parse(content);
  console.log(formatOutput(data));
  process.exit(0);
}

function formatOutput(data) {
  var now = Math.floor(new Date().getTime() / 1000);
  var result = data.stop_name + ": ";

  // Build output string
  // TODO: Configure this better for cleaner mode retrieval.
  var trips = data.mode[0].route[0].direction[0].trip.slice(0, 3);
  trips.forEach(function(n) {
    var fromNow = formatArrival(now, parseInt(n.pre_dt));
    result += fromNow && result.slice(-2) !== ": " ? ", " + fromNow : fromNow;
  });

  // Add alert counts
  if (data.alert_headers.length) {
    result += "; " + data.alert_headers.length + " alerts!";
  }

  return result;
}

function formatArrival(now, arr) {
  if (arr < now) { return ""; }
  if (arr - now < 60) { return "arriving now"; }
  if (arr - now < 120) { return "1 minute"; }
  if (arr - now < 3600) { return Math.floor((arr - now) / 60) + " minutes"; }
  return "over an hour";
}

// Determine the station from our config file
function requestMBTAStatus(networkName) {
  var http = require("http"),
      url = require("url"),
      config;

  // Given a network name, read our configuration file to
  try {
    config = JSON.parse(
      fs.readFileSync(process.env.HOME + "/.mbtastatusrc", "utf8")
    );
  } catch (err) {
    throw new Error("No .mbtastatusrc file found");
  }
  if (!config[networkName]) {
    throw new Error("No station preference for network: " + networkName);
  }

  // Hit the MBTA API for the predicted stops
  var options = {
    "host": "realtime.mbta.com",
    "path": url.format({
      "pathname": "/developer/api/v2/predictionsbystop",
      "query": {
        "api_key": process.env.MBTA_API_KEY,
        "stop": config[networkName],
        "format": "json"
      }
    })
  };
  var callback = function(resp) {
    var body = "";
    resp.on("data", function(chunk) { body += chunk; });
    resp.on("end", function() {
      // Cache the object and print out the result
      fs.writeFile(CACHE_FILE, body, function(err) {
        if (err) { throw err; }
        printOutput(body);
      });
    });
  };
  var req = http.request(options, callback);
  req.on("error", function() { throw new Error("No data access"); });
  req.end();
}

exports.formatOutput = formatOutput;
