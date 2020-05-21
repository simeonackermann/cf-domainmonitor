/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
const { ipcRenderer } = require('electron');
const storage = require('electron-json-storage');
const needle = require('needle');
const moment = require('moment');

const isDevelopment = process.env.NODE_ENV !== 'production'
const env = process.env.NODE_ENV || 'production';
let config = {}
try {
    config = require('../../config')[env];
} catch (e) {
    console.log('Configfile not found.');

}

window.$ = window.jQuery = require('jquery');
require( 'datatables.net-se' )();
require( 'datatables.net-buttons-se' )();
require( 'datatables.net-searchpanes-se' )();
require( 'datatables.net-select-se' )();

let apimail = config.apimail ? config.apimail : null
let apikey = config.apikey ? config.apikey : null
let limit = config.limit ? config.limit : undefined

window.addEventListener('DOMContentLoaded', () => {

    const dataPath = storage.getDataPath();
    console.log('storage dataPath', dataPath);

    // storage.get('foobar', function(error, data) {
    //     if (error) throw error;
    //     console.log('storage foobar:', data);
    //     storage.set('foobar', { foo: 'bar' }, function(error) {
    //         if (error) throw error;
    //       });
    // });

    if (apimail) document.querySelector("#mail").value = apimail
    if (apikey) document.querySelector("#key").value = apikey

    $(document).ready(function() {

        // fillTable()

        $("#config-form").submit((e) => {
            e.preventDefault()

            if ($("#mail").val() == "" || $("#key") == "") return;

            apimail = $("#mail").val()
            apikey = $("#key").val()

            init()
            $("#submit-btn").val("Reload")
            document.querySelector("#config-form").classList.add("loading")

            // $("#loading").css("display", "block")
            $("#message-wrapper").css("display", "none")
        })

        if (apimail && apikey) {
            // $("#submit-btn").click();
        }


        // ipcRenderer.send('init-data', true)

        // document.querySelectorAll("select.label").forEach((select) => {
        //     select.addEventListener('change', function() {
        //         console.log('You selected: ', this.value);
        //         saveLabel("foo.bar", this.value)
        //     });
        // })

    });
})

function saveLabel(domain = "", label = "", callback) {
    if (domain == "") return;

    storage.get('label', function(error, data) {
        if (error) {
            console.error(error);;
            return callback(false);
        }

        data[domain] = label
        console.log('Save Label:', domain, label, data);

        storage.set('label', data, function(error) {
            if (error) {
                console.error(error);;
                return callback(false);
            }
            return callback(true);
        });
    });
}

function getCached(key = "", maxAge = 60*60*24) {

}

function addCache(key = "", value = {}) {

}

function cfRequest(path, method = "get", data = {}) {
    const options = {
        json: true,
        headers: {
            'X-Auth-Email': apimail,
            'X-Auth-Key': apikey
        }
    }

    if (path[0] != "/") {
        path = "/" + path
    }

    return new Promise((resolve, reject) => {
        needle(method, `https://api.cloudflare.com/client/v4${path}`, data, options)
        .then(result => {
            // console.log('cfRequest result.body', result.body);
            if (!result.body || !result.body.success) {
                console.error('CF API request failed', result.body);
                if (result.body.errors) {
                    reject(new Error(JSON.stringify(result.body.errors)))
                } else {
                    reject(new Error("Unknown error on CF API request"))
                }

            }
            resolve(result.body)
        })
        .catch(error => {
            console.error('Error on CF API request:', error);
            reject(error)
        })
    })
}

function fetchAllZones(page = 1, prevZones = []) {
    const perPage = limit ? limit : 50
    let url = `/zones?page=${page}&per_page=${perPage}`;

    return new Promise((resolve, reject) => {
        cfRequest(url)
        .then(body => {
            const info = body.result_info
            if (body.result.length + prevZones.length >= limit) {
                return body.result
            }
            if (info.page < info.total_pages) {
                // do the recursive request here, append the results
                return fetchAllZones(page+1, body.result)
            }
            return body.result
        })
        .then(result => {
            // resolve the results and all previous results
            resolve([...prevZones, ...result])
        })
        .catch(error => {
            console.error("Error on fetch all zones:", error);
            reject(error)
        })
    });
}

function fetchDomains(accountId = "", names = []) {
    if (accountId == "")
        return new Promise((resolve, reject) => {reject(new Error('Empty account id given'))})

    return new Promise((resolve, reject) => {
        cfRequest(`/accounts/${accountId}/registrar/domains`, 'post', {"id": names})
        .then(body => {
            resolve(body.result)
        })
        .catch(error => {
            console.error("Error on fetch all domains:", error);
            reject(error)
        })
    });
}

function fetchDomainInfo(accountId = "", domain = "") {
    if (accountId == "" || domain == "")
        return new Promise((resolve, reject) => {reject(new Error('Empty account id or domain given'))})

    return new Promise((resolve, reject) => {
        cfRequest(`/accounts/${accountId}/registrar/domains/${domain}`, 'get')
        .then(body => {
            resolve(body.result)
        })
        .catch(error => {
            console.error("Error on fetch domain info:", error);
            reject(error)
        })
    });
}

function fetchDNS(zoneID = "") {
    if (zoneID == "")
        return new Promise((resolve, reject) => {reject(new Error('Empty zone id given'))})

    return new Promise((resolve, reject) => {
            cfRequest(`/zones/${zoneID}/dns_records`, 'get')
            .then(body => {
                resolve(body.result)
            })
            .catch(error => {
                console.error("Error on fetch dns records:", error);
                reject(error)
            })
        });
}

function init() {

    // TODO may use storage as cache

    let allZones = []
    let allDomains = []
    let allDNS = []

    fetchAllZones()
    .then(zones => {
        allZones = zones
        console.log('All zones:', zones);

        if (zones.length == 0) {
            return []
        }

        const accountId = zones[0]["account"]["id"]
        // const names = zones.map(z => z.name)
        // return fetchDomains(accountId, names)

        const accountDetailsPrms = [];
        zones.forEach(zone => {
            accountDetailsPrms.push(fetchDomainInfo(accountId, zone.name))
        })
        return Promise.all(accountDetailsPrms)
    })
    .then(domains => {
        console.log('Domain infos: ', domains);
        allDomains = domains

        // return fetchDNS(allZones[0]["id"])
        const dnsRecordPrms = [];
        allZones.forEach(zone => {
            dnsRecordPrms.push(fetchDNS(zone.id))
        })
        return Promise.all(dnsRecordPrms)
    })
    .then(dns => {
        console.log('DNS records: ', dns);
        allDNS = dns

        // get stored labels
        return new Promise((resolve, reject) => {
            storage.get('label', function(error, data) {
                if (error) reject(error);
                resolve(data)
            })
        })
    })
    .then(storedLabel => {
        console.log('Stored label', storedLabel);

        // MERGE DATA
        const mergedData = allZones.map(zone => {
            return Object.assign({},
                zone,
                allDomains.find (d => d.name == zone.name),
                { dns_recods: allDNS.find(d => {
                    if (d.length == 0) return false
                    return d.find(de => de.zone_id == zone.id)
                }) },
                { label: storedLabel.hasOwnProperty(zone.name) ? storedLabel[zone.name] : "" }
            )
        })
        console.log('All Data', mergedData);

        fillTable(mergedData);
    })
    .catch(error => {
        console.error('Error on init', error);

        const mbox = document.querySelector("#message-wrapper")
        mbox.style.display ="block"
        mbox.innerHTML = `<div class="header">Error</div><p>${error.toString()}</p>`
    })
    .finally(() => {
        document.querySelector("#config-form").classList.remove("loading")
    })

}

function fillTable(data) {
    document.getElementById("datatable").style.display ="table"

    const datatable = $('#datatable').DataTable({
        "paging": false, // disable pagination
        "select": {
            "style": 'multi'
        },
        "data": data,
        "columns": [
            { title: "Name", data: "name" },
            { title: "Expires", data: "expires_at", className: "date-cells" },
            { title: "DNS", data: null, orderable: false },
            { title: "Registrar", data: "current_registrar" },
            { title: "Locked", data: "locked" },
            { title: "Auto renew", data: function ( row, type, val, meta ) {
                return row.hasOwnProperty("auto_renew") ? row.auto_renew : 'undefined'
            } },
            { title: "Privacy", data: "privacy" },
            { title: "Fee", data: function ( row, type, val, meta ) {
                if (!Number.isFinite(row.fees.registration_fee)
                    || !Number.isFinite(row.fees.icann_fee)
                ) {
                    return row.fees.registration_fee + '<br />' + row.fees.icann_fee
                }
                return (row.fees.registration_fee + row.fees.icann_fee) + ' $'
            }},
            { title: "Label", data: "label", orderable: false }
        ],
        "columnDefs": [
            // expires at
            {
                targets: 1,
                render: function ( data, type, row, meta ) {
                    // const d = new Date(data)
                    // return d.toLocaleDateString();

                    const m = moment(data);
                    return m.format('YYYY-MMM-D')
                }
            },
            // DNS
            {
                targets: 2,
                render: function ( data, type, row, meta ) {
                    if (!data.dns_recods || data.dns_recods.length == 0) return "undefined"

                    let res = ""
                    data.dns_recods.forEach(record => {
                        if (record.type == "A") {
                            res = res + record.name + " = " + record.content + "<br />"
                        }
                    })
                    return res
                }
            },
            // locked
            {
                targets: 4,
                render: function ( data, type, row, meta ) {
                    return data ? '<i class="lock icon"></i>' : '<i class="lock open icon"></i>';
                }
            },
            // privacy
            {
                targets: 6,
                render: function ( data, type, row, meta ) {
                    return data ? '<i class="shield alternate icon"></i>' : '<i class="ban icon"></i>';
                }
            },
            // label
            {
                targets: -1,
                data: "label",
                render: function ( data, type, row, meta ) {
                    if (data) {
                        return getLabelUi(data).outerHTML
                    }
                    return getLabelSelectUi(["proxy", "torrent", "crypto", "vpn"], data).outerHTML
                }
            },

        ],
        "createdRow": function ( row, data, index ) {
            // TODO add data-sort and data-filter attribute to label cells
            // see https://datatables.net/examples/advanced_init/html5-data-attributes.html
            // if ( data[5].replace(/[\$,]/g, '') * 1 > 150000 ) {
            //     $('td', row).eq(5).addClass('highlight');
            // }
        }

        // TODO add selection checkbox:
        // https://datatables.net/extensions/select/examples/initialisation/checkbox.html
    })

    // event listener: select a label
    $('#datatable tbody').on( 'change', 'select', function () {
        var data = datatable.row( $(this).parents('tr') ).data();
        var value = $("option:selected", this).text();

        saveLabel(data.name, value, (res) => {
            if (!res) return
            // TODO show error
            $(this).parents('td').append(getLabelUi(value))
            $(this).parent().remove()
        })


    } );

    // event listener: remove label
    $('#datatable tbody').on( 'click', '.delete-label', function () {
        var data = datatable.row( $(this).parents('tr') ).data();
        console.log('Delete label', data);

        saveLabel(data.name, "", (res) => {
            if (!res) return
            // TODO show error
            $(this).parent().after(getLabelSelectUi(["proxy", "torrent", "crypto", "vpn"], data))
            $(this).parent().remove();
        })
    } );
}

function getLabelUi(label = "") {
    const doc = new DOMParser().parseFromString(`<a class="ui label">${label} <i class="delete icon delete-label"></i></a>`, "text/html")
    return doc.body.firstChild;
}

function getLabelSelectUi(options = [], value = "") {
    // const options = ["proxy", "torrent", "crypto", "vpn"]
    const doc = new DOMParser().parseFromString(`
        <div class="ui form label-select">
            <select class="ui fluid dropdown label">
                <option></option>
            </select>
        </div>
    `, "text/html")

    const select = doc.querySelector("select")

    options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.text = opt;

        if (value == opt) {
            option.selected = true
            option.setAttribute("selected", true)
        }

        select.appendChild(option);
    })

    return doc.body.firstChild;
}

// ipcRenderer.on("tabledata", (e, data) => {
//     console.log('data in renderer', data);

// })