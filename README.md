# Cloudflare Domain Monitor

List details of you cloudflare domains (name, expires, dns, registrar, locked, renew, privacy, fee) and allow to add labels

Build with [`electron-webpack`](https://github.com/electron-userland/electron-webpack)

Downoad: see page [releases](https://github.com/simeonackermann/cf-domainmonitor/releases)

Mac: use `Domain Monitor...dmg`

Linux: use `DomainMonitor...AppImage`

[![Build Status](https://travis-ci.org/simeonackermann/cf-domainmonitor.svg?branch=master)](https://travis-ci.org/simeonackermann/cf-domainmonitor)

## Development

Install [yarn](https://yarnpkg.com/) as package manager is **strongly** recommended, as opposed to using `npm`.

Simply clone down this repository, install dependencies, and get started on your application.

```bash
# install dependencies
yarn

# run application in development mode
yarn dev

# compile source code and create webpack output
yarn compile

# `yarn compile` & create build with electron-builder
yarn dist

# `yarn compile` & create unpacked build with electron-builder
yarn dist:dir
```
