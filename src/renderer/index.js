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
let limit = config.limit ? config.limit : null

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

        if (apimail && apikey) {
            console.log("Submit the form?!");

            // $("#config-form").submit((e) => { e.preventDefault()})
        }

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
        // ipcRenderer.send('init-data', true)

        // document.querySelectorAll("select.label").forEach((select) => {
        //     select.addEventListener('change', function() {
        //         console.log('You selected: ', this.value);
        //         saveLabel("foo.bar", this.value)
        //     });
        // })

    });
})

function saveLabel(domain = "", label = "") {
    if (domain == "" || label == "") return;

    storage.get('label', function(error, data) {
        if (error) throw error;

        data[domain] = label
        console.log('Save Label:', domain, label, data);

        storage.set('label', data, function(error) {
            if (error) throw error;
        });
    });
}

function cfRequest(path, method = "get", data = {}) {
    const options = {
        json: true,
        headers: {
            'X-Auth-Email': apimail,
            'X-Auth-Key': apikey
        }
    }

    return new Promise((resolve, reject) => {
        needle(method, `https://api.cloudflare.com/client/v4/${path}`, data, options)
        .then(result => {
            // console.log('cfRequest result.body', result.body);
            if (!result.body || !result.body.success) {
                console.error('CF API request failed', result.body);
                if (result.body.errors) {
                    reject(new Error(JSON.stringify(result.body.errors)))
                } else {
                    reject(new Error("Unknown error"))
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

function init() {

    // TODO may use storage as cache

    let allZones = []
    let allDomains = []

    fetchAllZones()
    .then(zones => {
        allZones = zones
        console.log('All zones:', zones);

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

        return new Promise((resolve, reject) => {
            storage.get('label', function(error, data) {
                if (error) reject(error);
                resolve(data)
            })
        })
    })
    .then(storedLabel => {
        console.log('storedLabel', storedLabel);

        const mergedData = allZones.map(zone => {
            return Object.assign({},
                zone,
                allDomains.find (d => d.name == zone.name),
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
            { title: "Expires", data: "expires_at" },
            { title: "Registrar", data: "current_registrar" },
            { title: "Locked", data: "locked" },
            { title: "Label", data: "label" }
        ],
        "columnDefs": [ {
            "targets": -1,
            "data": "label",
            // "defaultContent": "<button>Click!</button>"
            "render": function ( data, type, row, meta ) {
                // console.log('Add data to row', data, type, row, meta);
                const options = ["proxy", "torrent", "crypto", "vpn"]
                // options.includes(data.label)

                const wrapper = document.createElement("div");
                wrapper.classList.add("ui", "form")

                const select = document.createElement("select");
                select.classList.add("ui", "fluid", "dropdown", "label")

                const option = document.createElement("option");
                option.text = "";
                select.appendChild(option);

                options.forEach((opt) => {
                    const option = document.createElement("option");
                    option.value = opt;
                    option.text = opt;

                    if (data == opt) {

                        option.selected = true
                        option.setAttribute("selected", true)
                    }

                    select.appendChild(option);
                })
                wrapper.appendChild(select)

                return wrapper.outerHTML
            }
        } ]
        // TODO add selection checkbox:
        // https://datatables.net/extensions/select/examples/initialisation/checkbox.html
    })

    $('#datatable tbody').on( 'change', 'select', function () {
        var data = datatable.row( $(this).parents('tr') ).data();
        // alert( data[0] +"'s salary is: "+ data[ 5 ] );
        var value = $("option:selected", this).text();
        console.log('Change select list', this, value, data);
        saveLabel(data.name, value)
    } );
}

ipcRenderer.on("tabledata", (e, data) => {
    console.log('data in renderer', data);

})