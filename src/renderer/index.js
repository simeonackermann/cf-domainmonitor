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

window.$ = window.jQuery = require('jquery');
require( 'datatables.net-se' )();
require( 'datatables.net-buttons-se' )();
require( 'datatables.net-searchpanes-se' )();
require( 'datatables.net-select-se' )();

let apimail = ""
let apikey = ""

window.addEventListener('DOMContentLoaded', () => {

    // const dataPath = storage.getDataPath();
    // console.log('storage dataPath', dataPath);

    // storage.get('foobar', function(error, data) {
    //     if (error) throw error;

    //     console.log('storage foobar', data);
    //     storage.set('foobar', { foo: 'bar' }, function(error) {
    //         if (error) throw error;
    //       });
    // });

    $(document).ready(function() {

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
    });


})

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
    const perPage = 50
    let url = `/zones?page=${page}&per_page=${perPage}`;

    return new Promise((resolve, reject) => {
        cfRequest(url)
        .then(body => {
            const info = body.result_info
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

        // console.log("All domains:", domains);

        const mergedData = allZones.map(zone => {
            return Object.assign({}, zone, domains.find (d => d.name == zone.name))
        })
        console.log('All Data', mergedData);

        fillTable(mergedData);
    })
    .catch(error => {
        console.error('Error on init', error);
        document.getElementById("loading").style.display ="none"

        const mbox = document.querySelector("#message-wrapper")
        mbox.style.display ="block"
        mbox.innerHTML = `<div class="header">Error</div><p>${error.toString()}</p>`
    })
    .finally(() => {
        document.querySelector("#config-form").classList.remove("loading")
    })

}

function fillTable(data) {
    document.getElementById("loading").style.display ="none"
    document.getElementById("datatable").style.display ="table"

    $('#datatable').DataTable({
        "paging": false, // disable pagination
        select: {
            style: 'multi'
        },
        "data": data,
        "columns": [
            { title: "Name", data: "name" },
            { title: "Expires", data: "expires_at" },
            { title: "Registrar", data: "current_registrar" }
        ]
        // TODO add selection checkbox:
        // https://datatables.net/extensions/select/examples/initialisation/checkbox.html
    })

    // $('#datatable tbody').on( 'click', 'tr', function () {
    //     $(this).toggleClass('selected');
    // } );
}

ipcRenderer.on("tabledata", (e, data) => {
    console.log('data in renderer', data);

})