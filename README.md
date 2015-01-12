MBTA Status Line
================

Display subway arrival information in your terminal (I use it in my tmux status
bar) for stations corresponding to your WiFi network.

## Installation and Use

Install node and npm if you haven't already.

```bash
# For example, with homebrew on Mac OSX
$ brew install node
```

Install the script

```bash
$ npm install gthole/mbtastatusline
```

Then create a configuration file at `~/.mbtastatusrc` in your user directory.

This should be a JSON object where the keys are the names of the WiFi networks
you want to check the MBTA from, and the keys are the subway station IDs to
associate with them:

For example:

```JSON
{
  "MyHomeNetwork": "70092",
  "WorkWiFi": "70048"
}
```

Finally, you need to export the environment variable `MBTA_API_KEY` with your 
api key to the MBTA API.  You can get one at the [MBTA developer
portal](http://realtime.mbta.com/portal).

Then it should be ready to use!

```bash
$ node_modules/.bin/mbtastatusline
Shawmut - Inbound: 1 minute, 11 minutes, 33 minutes; 2 alerts!
```