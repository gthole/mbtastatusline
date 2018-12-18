#!/usr/local/bin/node

'use strict';

const fs = require('fs'),
      http = require('https'),
      childProcess = require('child_process'),
      url = require('url');


// Cache lasts three minutes
const CACHE_DURATION = 180 * 1000,
      CACHE_FILE = '/usr/local/var/mbtastatuscache';


function formatArrival(now, arr) {
    if (arr < now) return '';
    if (arr - now < 60) return 'arriving now';
    if (arr - now < 120) return '1 minute';
    if (arr - now < 3600) return `${Math.floor((arr - now) / 60)} minutes`;
    return 'over an hour';
}


function formatOutput(body, config) {
    const now = Date.now() / 1000;
    const stop = body.included.filter((incl) => incl.type === 'stop')[0].attributes.name;
    let result = `${stop}: `;

    // Build output string
    const trips = body.included
        .filter((incl) => {
            if (incl.type !== 'trip') return false;
            if (config.headsign && incl.attributes.headsign !== config.headsign) return false;
            return true;
        })
        .map((trip) => trip.id);

    const predictions = body.data.filter((prediction) => {
        return trips.includes(prediction.relationships.trip.data.id);
    }).slice(0, 3);
    predictions.forEach((p) => {
        const fromNow = formatArrival(now, new Date(p.attributes.arrival_time).valueOf() / 1000);
        result += fromNow && result.slice(-2) !== ': ' ? `, ${fromNow}` : fromNow;
    });
    if (predictions.length === 0) result += 'No trains';

    // Add alert counts
    const alerts = body.included.filter((incl) => {
        return incl.type === 'alert' && incl.attributes.cause !== 'MAINTENANCE';
    });
    if (alerts.length) {
        result += `; ${alerts.length} alerts!`;
    }

    return result;
}

function printOutput(body, config) {
    // Print to stdout and exit
    if (body.error || body.errors) {
        console.log(body);
        process.exit(1);
    }
    console.log(formatOutput(body, config));
    process.exit(0);
}

// Determine the station from our config file
function requestMBTAStatus(networkName) {
    let rc;

    // Given a network name, read our configuration file to
    try {
        rc = JSON.parse(
            fs.readFileSync(`${process.env.HOME}/.mbtastatusrc.json`, 'utf8')
        );
    } catch (err) {
        throw new Error('No .mbtastatusrc file found');
    }
    const config = rc[networkName];
    if (!config || !config.stop) {
        throw new Error(`No station preference for network: ${networkName}`);
    }

    // Hit the MBTA API for the predicted stops
    const options = {
        host: 'api-v3.mbta.com',
        path: url.format({
            pathname: '/predictions',
            query: {
                'api_key': rc.MBTA_API_KEY,
                'include': 'trip,alert,stop',
                'filter[stop]': config.stop
            }
        })
    };

    const req = http.request(options, (resp) => {
        let content = '';
        resp.on('data', (chunk) => content += chunk);
        resp.on('end', () => {
            const body = JSON.parse(content);

            // Cache the object and print out the result
            fs.writeFile(CACHE_FILE, JSON.stringify({config, body}), (err) => {
                if (err) throw err;
                printOutput(body, config);
            });
        });
    });
    req.on('error', () => {
        throw new Error('No data access');
    });
    req.end();
}

function updateCache() {
    // Get the wifi network name (MacOSX only here)
    const exec = childProcess.exec;

    exec('networksetup -getairportnetwork en0', (err, stdout, stderr) => {
        // TODO: ip range fallback for wired connections?
        if (err || stderr || stdout.lastIndexOf('Current Wi-Fi Network: ') !== 0) {
            throw new Error('No wifi network access');
        }

        // Strip 'Current Wi-Fi Network: ' prefix off the output
        const networkName = stdout.slice(23).trim();
        requestMBTAStatus(networkName);
    });
}

// Main entry
if (require.main === module) {
    try {
        fs.stat(CACHE_FILE, (err, stat) => {
            if (err) return updateCache();
            const now = new Date().getTime();
            if (now - stat.ctime.getTime() > CACHE_DURATION) {
                return updateCache();
            }
            fs.readFile(CACHE_FILE, (err, content) => {
                if (err) throw err;
                const cached = JSON.parse(content);
                printOutput(cached.body, cached.config);
            });
        });
    } catch (err) {
        console.log(err);
    }
}


exports.formatOutput = formatOutput;
