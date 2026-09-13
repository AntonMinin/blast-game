(function () {
    'use strict';

    var CHECKING_RETRY_MS = 1000;
    var FAILED_RETRY_MS = 2000;

    var canvas = document.getElementById('GameCanvas');
    window.onload = function () {
        if (!isTypecheckPassed()) {
            return;
        }

        if (window.__quick_compile_engine__) {
            window.__quick_compile_engine__.load(onload);
        }
        else {
            onload();
        }
    };

    function isTypecheckPassed () {
        var status = window.TYPECHECK_STATUS;
        if (status && status.state === 'passed') {
            return true;
        }

        showTypecheckScreen(status);
        var retryDelay = status && status.state === 'failed' ? FAILED_RETRY_MS : CHECKING_RETRY_MS;
        setTimeout(function () {
            window.location.reload();
        }, retryDelay);
        return false;
    }

    function showTypecheckScreen (status) {
        document.getElementById('splash').style.display = 'none';

        var screen = document.createElement('div');
        screen.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;overflow:auto;padding:24px;' +
            'background:#0b1a2e;color:#ffffff;font:14px/1.6 monospace;white-space:pre-wrap;z-index:10;';

        if (!status) {
            screen.textContent = 'Статус проверки TypeScript недоступен.\n' +
                'Откройте проект в Cocos Creator: расширение packages/typecheck выполнит проверку.';
        }
        else if (status.state === 'checking') {
            screen.textContent = 'Проверка TypeScript...';
        }
        else {
            screen.style.color = '#ff8a9e';
            screen.textContent = 'Игра не запущена: ошибки TypeScript (' + status.errors.length + ')\n\n' +
                status.errors.join('\n');
        }

        document.body.appendChild(screen);
    }

    function onload () {

        // socket
        // =======================

        // Receives a refresh event from the editor, which triggers the reload of the page
        var socket = window.io();
        socket.on('browser:reload', function () {
            window.location.reload();
        });
        socket.on('browser:confirm-reload', function () {
            var r = confirm( 'Reload?' );
            if ( r ) {
                window.location.reload();
            }
        });

        // init engine
        // =======================

        var engineInited = false;

        var onStart = function () {
            cc.view.enableRetina(true);
            cc.view.resizeWithBrowserSize(true);

            // Loading splash scene
            var splash = document.getElementById('splash');
            var progressBar = splash.querySelector('.progress-bar span');

            cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {
                splash.style.display = 'none';
            });

            cc.game.pause();

            // init assets
            engineInited = true;

            cc.assetManager.loadAny({url: 'preview-scene.json', __isNative__: false }, null, function (finish, totalCount) {
                var percent = 100 * finish / totalCount;
                if (progressBar) {
                    progressBar.style.width = percent.toFixed(2) + '%';
                }
            }, function (err, sceneAsset) {
                if (err) {
                    console.error(err.message, err.stack);
                    return;
                }
                var scene = sceneAsset.scene;
                scene._name = sceneAsset._name;
                cc.assetManager.dependUtil._depends.add(scene._id, cc.assetManager.dependUtil._depends.get('preview-scene.json'));
                cc.director.runSceneImmediate(scene, function () {
                    // play game
                    cc.game.resume();
                });
            });

            // purge
            //noinspection JSUnresolvedVariable
            _CCSettings = undefined;
        };

        var option = {
            id: canvas,
            debugMode: _CCSettings.debug ? cc.debug.DebugMode.INFO : cc.debug.DebugMode.ERROR,
            showFPS: _CCSettings.debug,
            frameRate: 60,
            groupList: _CCSettings.groupList,
            collisionMatrix: _CCSettings.collisionMatrix,
        };

        cc.assetManager.init({
            importBase: 'assets/others/import',
            nativeBase: 'assets/others/native'
        });

        let { RESOURCES, INTERNAL, MAIN } = cc.AssetManager.BuiltinBundleName;
        var bundleRoot = [INTERNAL];
		_CCSettings.hasResourcesBundle && bundleRoot.push(RESOURCES);

        var count = 0;
        function cb (err) {
            if (err) return console.error(err);
            count++;
            if (count === bundleRoot.length + 1) {
                cc.assetManager.loadBundle(MAIN, function (err) {
                    if (!err) cc.game.run(option, onStart);
                });
            }
        }

        // load plugins
        cc.assetManager.loadScript(_CCSettings.jsList.map(function (x) { return '/plugins/' + x; }), cb);

        // load bundles
        for (let i = 0; i < bundleRoot.length; i++) {
            cc.assetManager.loadBundle('assets/' + bundleRoot[i], cb);
        }
    }
})();
