var model;
var clock = new THREE.Clock();
var mixers = [];

function isMobile() {
    return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

var interpolationFactor = 20;

var trackedMatrix = {
    // for interpolation
    delta: [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0
    ],
    interpolated: [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0
    ]
}

var markers = {
    qr_code_legacy: {
        width: 1238,
        height: 1238,
        dpi: 300,
        url: "../examples/DataNFT/qr-code_legacy"
    },
    qr_code_stable: {
        width: 938,
        height: 938,
        dpi: 300,
        url: "../examples/DataNFT/qr-code_stable"
    },
    qr_code_prelegacy: {
        width: 370,
        height: 370,
        dpi: 300,
        url: "../examples/DataNFT/qr-code_prelegacy"
    },
    pinball: {
        width: 1077,
        height: 1077,
        dpi: 215,
        url: "../examples/DataNFT/pinball"
    },
    newYear_marker: {
        width: 1637,
        height: 2048,
        dpi: 220,
        url: "../examples/DataNFT/newYear_marker"
    },
};

var setMatrix = function(matrix, value) {
    var array = [];
    for (var key in value) {
        array[key] = value[key];
    }
    if (typeof matrix.elements.set === "function") {
        matrix.elements.set(array);
    } else {
        matrix.elements = [].slice.call(array);
    }
};

function start(container, marker, video, input_width, input_height, canvas_draw, render_update) {
    var vw, vh;
    var sw, sh;
    var pscale, sscale;
    var w, h;
    var pw, ph;
    var ox, oy;
    var worker;
    var camera_para = "./../examples/Data/camera_para-iPhone 5 rear 640x480 1.0m.dat";

    var canvas_process = document.createElement("canvas");
    var context_process = canvas_process.getContext("2d");

    // var context_draw = canvas_draw.getContext('2d');
    var renderer = new THREE.WebGLRenderer({
        canvas: canvas_draw,
        alpha: true,
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);

    var scene = new THREE.Scene();

    //var camera = new THREE.Camera();
    //camera.matrixAutoUpdate = false;
    var camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 1, 1000000);
    camera.position.z = 400;

    scene.add(camera);

    var light = new THREE.AmbientLight(0xffffff);
    scene.add(light);

    var root = new THREE.Object3D();
    scene.add(root);

    /* Load Model */
    var threeGLTFLoader = new THREE.GLTFLoader();
    var action;


    var modelPose = new THREE.Vector3(0, 0, 0);
    var threeGLTFLoader = new THREE.GLTFLoader();

    threeGLTFLoader.load("../Data/models/SnowMan.glb", function(gltf) {
        model = gltf.scene.children[0];

        model.position.z = 0;
        model.position.x = 400;
        model.position.y = -2500;

        model.scale.z = 6000;
        model.scale.x = 6000;
        model.scale.y = 6000;


        var animation = gltf.animations[0];
        var mixer = new THREE.AnimationMixer(model);
        mixers.push(mixer);
        action = mixer.clipAction(animation);


        root.matrixAutoUpdate = false;
        root.add(model);

        let b = new THREE.Vector3(0, 0, 0);
        modelPose.subVectors(model.position, b.setFromMatrixPosition(root.matrix));
    });

    const listener = new THREE.AudioListener();
    camera.add(listener);

    const sound = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('../Data/sound/audio_snowman.ogg', function(buffer) {
        sound.setBuffer(buffer);
        sound.setLoop(false);
        sound.setVolume(0.5);
    });




    var standalone = window.navigator.standalone,
        userAgent = window.navigator.userAgent.toLowerCase(),
        safari = /safari/.test(navigator.userAgent),
        ios = /iphone|ipod|ipad/.test(navigator.userAgent);

    var parser = new UAParser();

    var load = function() {
        vw = input_width;
        vh = input_height;

        pscale = 320 / Math.max(vw, vh);
        sscale = isMobile() ? window.outerWidth / input_width : 1;

        sw = vw;
        sh = vh;
        video.style.width = sw + "px";
        video.style.height = sh + "px";
        container.style.width = sw + "px";
        container.style.height = sh + "px";
        canvas_draw.style.clientWidth = sw + "px";
        canvas_draw.style.clientHeight = sh + "px";
        canvas_draw.Width = sw;
        canvas_draw.Height = sh;
        w = vw;
        h = vh;
        pw = Math.max(w, (h / 3) * 4);
        ph = Math.max(h, (w / 4) * 3);
        ox = (pw - w) / 2;
        oy = (ph - h) / 2;
        canvas_process.style.clientWidth = pw + "px";
        canvas_process.style.clientHeight = ph + "px";

        canvas_process.width = pw;
        canvas_process.height = ph;

        renderer.setSize(sw, sh);

        worker = new Worker("../../js/artoolkit.worker.js");

        worker.postMessage({
            type: "load",
            pw: pw,
            ph: ph,
            camera_para: camera_para,
            marker: marker.url
        });

        var toggleFlag = false;
        var blocker = false;
        var hideCall;
        var unHideCall;
        var stopSound;

        worker.onmessage = function(ev) {
            var msg = ev.data;
            switch (msg.type) {
                case "loaded":
                    {
                        var proj = JSON.parse(msg.proj);
                        var ratioW = pw / w;
                        var ratioH = ph / h;
                        proj[0] *= ratioW;
                        proj[4] *= ratioW;
                        proj[8] *= ratioW;
                        proj[12] *= ratioW;
                        proj[1] *= ratioH;
                        proj[5] *= ratioH;
                        proj[9] *= ratioH;
                        proj[13] *= ratioH;
                        //setMatrix(camera.projectionMatrix, proj);
                        break;
                    }

                case "endLoading":
                    {
                        if (msg.end == true) {
                            // removing loader page if present
                            var loader = document.getElementById('loading');
                            if (loader) {
                                loader.querySelector('.loading-text').innerText = 'Начинаем!';
                                setTimeout(function() {
                                    loader.parentElement.removeChild(loader);
                                    blocker = true;
                                }, 2000);
                            }
                        }
                        break;
                    }

                case "found":
                    {
                        if (toggleFlag && blocker) {
                            if (unHideCall != null) {
                                clearTimeout(unHideCall);
                            }
                            if (stopSound != null) {
                                clearTimeout(stopSound);
                            }
                            var hint = document.getElementById('not_tracked');
                            if (hint) {
                                hideCall = setTimeout(function() {
                                    hint.style.visibility = "hidden";
                                    sound.setVolume(0.5);
                                }, 600);
                            }
                            toggleFlag = !toggleFlag;
                        }
                        found(msg);
                        break;
                    }
                case "not found":
                    {
                        if (!toggleFlag && blocker) {
                            if (hideCall != null) {
                                clearTimeout(hideCall);
                            }
                            var hint = document.getElementById('not_tracked');
                            if (hint) {
                                unHideCall = setTimeout(function() {
                                    hint.style.visibility = "visible";
                                }, 600);
                                stopSound = setTimeout(function() {
                                    sound.setVolume(0.0);
                                }, 1200);
                            }
                            toggleFlag = !toggleFlag;
                        }
                        found(null);
                        break;
                    }
            }
            //track_update();
            process();
        };
    };

    var world;

    var found = function(msg) {
        if (!msg) {
            world = null;
        } else {
            world = JSON.parse(msg.matrixGL_RH);
        }
    };

    var lasttime = Date.now();
    var time = 0;

    function process() {
        context_process.fillStyle = "black";
        context_process.fillRect(0, 0, pw, ph);
        context_process.drawImage(video, 0, 0, vw, vh, ox, oy, w, h);

        var imageData = context_process.getImageData(0, 0, pw, ph);
        worker.postMessage({ type: "process", imagedata: imageData }, [
            imageData.data.buffer
        ]);
    }

    var tick = function() {
        draw();
        requestAnimationFrame(tick);

        if (mixers.length > 0) {
            for (var i = 0; i < mixers.length; i++) {
                mixers[i].update(clock.getDelta());
            }
        }
    };

    var flagAudio = true;

    var rootQuaternion = new THREE.Quaternion();
    var modelPoseCopy = new THREE.Vector3();

    var draw = function() {
        //render_update();
        var now = Date.now();
        var dt = now - lasttime;
        time += dt;
        lasttime = now;

        if (!world) {
            root.visible = false;
        } else {
            root.visible = true;
            if (flagAudio) {
                flagAudio = false;
                action.play();
                setTimeout(function() {
                    sound.play();
                }, 2300)
            }

            // interpolate matrix
            for (var i = 0; i < 16; i++) {
                trackedMatrix.delta[i] = world[i] - trackedMatrix.interpolated[i];
                trackedMatrix.interpolated[i] =
                    trackedMatrix.interpolated[i] +
                    trackedMatrix.delta[i] / interpolationFactor;
            }

            // set matrix of 'root' by detected 'world' matrix
            setMatrix(root.matrix, trackedMatrix.interpolated);

            rootQuaternion.setFromRotationMatrix(root.matrix);

            modelPoseCopy.copy(modelPose);
            modelPoseCopy.applyQuaternion(rootQuaternion);

            //model.position.set(modelPoseCopy.x, modelPoseCopy.y, modelPoseCopy.z);
        }

        renderer.render(scene, camera);
    };

    load();
    tick();
    process();
}