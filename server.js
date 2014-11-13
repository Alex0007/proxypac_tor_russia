var dump_url = 'https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv';
var proxy_string = 'SOCKS5 127.0.0.1:9050'; // tor proxy
var proxy_pac_path = __dirname + '/static/proxy.pac';


var fs = require('fs');
var express = require('express');
var schedule = require('node-schedule');
var request = require('request');
var moment = require('moment');

var app = express();
app.use(express.static(__dirname + '/static'));
app.use(require('prerender-node').set('prerenderToken', process.env.PRERENDER_TOKEN));


function remove_duplicates(array) {
    var uniq_array = array.reduce(function (a, b) {
        if (a.indexOf(b) < 0) a.push(b);
        return a;
    }, []);
    return uniq_array;
}

function removeMatching(originalArray, regex) {
    var j = 0;
    while (j < originalArray.length) {
        if (regex.test(originalArray[j]))
            originalArray.splice(j, 1);
        else
            j++;
    }
    return originalArray;
}

function array_to_pac(array, array_name, writeStream) {
    writeStream.write('\n' + array_name + ' = [');
    for (var key in array) {
        writeStream.write('"' + array[key] + '",');
    }
    writeStream.write(']');
}

function parse_dump(filename) { //parse ip adresses from file
    var fs = require('fs')
    fs.readFile(filename, 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }
        var regex_ip = /(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\s|;)/g;
        var regex_url = /(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/g;
        var ips = data.match(regex_ip);
        var urls = data.match(regex_url);
        for (var key in ips) {
            ips[key] = ips[key].slice(0, -1);
        }
        ips = remove_duplicates(ips);
        urls = remove_duplicates(urls);
        urls = removeMatching(urls, /.php$|.html$|.jpe?g$|.png$/); // cleaning some trash

        build_pac(proxy_pac_path, ips, urls); // generate pac-file

    });
}

function build_pac(filename, ips, urls) { // .pac-file builder
    console.log('generating new proxy pac');

    var file = fs.createWriteStream(filename);
    file.write('// proxypac_gen_russia, autogenerated on ' + moment().utc().add('hours', 3).format('LLL') + " (MSK)\n");
    file.write('// ' + ips.length + " IPs and " + urls.length + " domains in list\n\n");
    file.write('function FindProxyForURL(url, host) {');

    array_to_pac(ips, 'blocked_ips', file);
    array_to_pac(urls, 'blocked_urls', file);

    file.write('\n\n  if ((blocked_ips.indexOf(dnsResolve(host)) != -1) || (blocked_urls.indexOf(host) != -1)) {\n    return "' + proxy_string + '; DIRECT";\n  }\n  if (dnsDomainIs(host, ".onion")) {\n    return "SOCKS5 127.0.0.1:9050; DIRECT"; // tor proxy\n  }\n  if (dnsDomainIs(host, ".i2p")) {\n    return "PROXY 127.0.0.1:4444"; // i2p proxy\n  }\n\n  return "DIRECT";\n}');
    file.end();
    console.log('.pac file generated successfully at ' + moment().utc().add('hours', 4).format('LLL') + " (MSK)\n");
}

function generate_pac() {
    //saving file with rkn dump
    try {
        var file = fs.createWriteStream("dump.txt");
        var r = request(dump_url).pipe(file);
        r.on("finish", function () {
            // call parser
            parse_dump("dump.txt");
        });
    } catch (e) {
        console.log('Something going wrong in .pac generation: ' + e.message);
        throw e;
    }
}

generate_pac();
if (process.argv.indexOf('--once') == -1) {
    var rule = new schedule.RecurrenceRule();
    rule.minute = new schedule.Range(0, 59, 30); // run task every 30 minutes
    schedule.scheduleJob(rule, generate_pac);

    if (process.argv.indexOf('--webserver') != -1) {
        var server = app.listen(process.env.PORT || 3000, function () { // starting web-server
            console.log('Listening on port %d', server.address().port);
        });

        app.get('/github_readme', function (req, res) { // getting content from github and sending to user
            var r = request('https://raw.githubusercontent.com/Alex0007/proxypac-gen-russia/master/README.md', function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    res.send(body);
                } else {
                    console.log('Something going wrong in /github_readme');
                    res.send('Что-то пошло не так. Попробуйте перезагрузить страницу.');
                }
            });

        });
    }
}
