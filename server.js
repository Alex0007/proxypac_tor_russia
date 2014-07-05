var dump_url = 'https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv';
var proxy_string = 'SOCKS5 127.0.0.1:9050'; // tor proxy


var fs = require('fs');
var express = require('express');
var schedule = require('node-schedule');
var request = require('request');
var async = require('async');
var moment = require('moment');

var app = express();
app.use(express.static(__dirname + '/static'));

function remove_duplicates(array) {
    var uniq_array = array.reduce(function (a, b) {
        if (a.indexOf(b) < 0) a.push(b);
        return a;
    }, []);
    return uniq_array;
}

function parse_dump(filename) { //parse ip adresses from file
    console.log('parse started');
    var fs = require('fs')
    fs.readFile(filename, 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }
        var regex_ip = /(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]);/g;
        var regex_url = /(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/g;
        var ips = data.match(regex_ip);
        var urls = data.match(regex_url);
        for (var key in ips) {
            ips[key] = ips[key].slice(0, -1);
        }
        ips = remove_duplicates(ips);
        urls = remove_duplicates(urls);
        build_pac(__dirname + '/static/proxy.pac', ips, urls); //generate pac-file

    });
}

function build_pac(filename, ips, urls) { // .pac-file builder
    console.log('generating new proxy pac');
    var file = fs.createWriteStream(filename);
    file.write('// proxypac_gen_russia, autogenerated on ' + moment().utc().add('hours', 4).format('LLL') + " (MSK)\n");
    file.write('// ' + ips.length + " IPs and " + urls.length + " domains in list\n\n");
    file.write('function FindProxyForURL(url, host) {\n  blockedips = [ ');
    // insert IPs start
    for (var key in ips) {
        file.write('\n    "' + ips[key] + '",');
    }
    file.write('\n');
    file.write('      ]');
    // insert IPs end

    //insert URLs start
    file.write('\n  blockedurls = [ ');
    for (var key in urls) {
        file.write('\n    "' + urls[key] + '",');
    }
    file.write('\n');
    // insert URLs end

    file.write('      ];\n\n  if ((blockedips.indexOf(dnsResolve(host)) != -1) || (blockedurls.indexOf(host) != -1)) {\n    return "' + proxy_string + '; DIRECT";\n  }\n\n  return "DIRECT";\n}');
    file.end();

}

function generate_pac() {
    //saving file with rkn dump
    var file = fs.createWriteStream("dump.txt");
    var r = request("https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv").pipe(file);
    r.on("finish", function () {

        // call parser
        parse_dump("dump.txt");
    });
}

generate_pac();
var rule = new schedule.RecurrenceRule();
rule.minute = new schedule.Range(0, 59, 15); // run task every 15 minutes
schedule.scheduleJob(rule, generate_pac);

var server = app.listen(process.env.PORT || 3000, function () { //starting web-server
    console.log('Listening on port %d', server.address().port);
});
