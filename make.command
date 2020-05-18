#!/bin/bash -e

# change to dir of the script
cd -- "$(dirname "$BASH_SOURCE")"

# make option: all, mac, linux
MAKE=$1

if [[ $MAKE == "" ]] ; then
    declare MAKE=make
else
    declare MAKE=make-$MAKE
fi

NAME="electronuserland-builder"

echo ""
echo "# Going to execute: ${MAKE}"
echo ""

echo "Setup docker container..."
docker run --rm -td \
    --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
    --env ELECTRON_CACHE="/root/.cache/electron" \
    --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
    -v ${PWD}:/project \
    -v ${PWD##*/}-node-modules:/project/node_modules \
    -v ~/.cache/electron:/root/.cache/electron \
    -v ~/.cache/electron-builder:/root/.cache/electron-builder \
    --name $NAME \
    electronuserland/builder

echo ""
echo "Install packages and run make scripts..."
docker exec -it $NAME yarn && yarn $MAKE

echo ""
echo "Stop docker container..."
docker stop $NAME

echo ""
echo "Done. Output binaries see: ./dist/"