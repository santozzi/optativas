// Stub para canvas — pdfjs-dist lo necesita solo para renderizado visual,
// no para la extracción de texto (que usa pdftotext/tesseract)
const fs = require('fs');
const path = require('path');
const canvasPath = path.join('/app/node_modules', 'canvas');
fs.mkdirSync(canvasPath, { recursive: true });
fs.writeFileSync(path.join(canvasPath, 'index.js'), `module.exports = {
  createCanvas: function(w, h) {
    return {
      width: w, height: h,
      getContext: function() {
        return {
          majorVersion: 2, minorVersion: 0,
          addHitRegion: function(){}, clearRect: function(){},
          clip: function(){}, drawImage: function(){},
          fill: function(){}, fillRect: function(){},
          fillText: function(){}, getImageData: function(){ return {data: Buffer.alloc(0)}; },
          getLineDash: function(){ return []; },
          isPointInPath: function(){ return false; },
          isPointInStroke: function(){ return false; },
          lineTo: function(){}, measureText: function(){ return {width: 0}; },
          moveTo: function(){}, putImageData: function(){},
          quadraticCurveTo: function(){}, rect: function(){},
          resetTransform: function(){}, restore: function(){},
          rotate: function(){}, save: function(){},
          scale: function(){}, setLineDash: function(){},
          setTransform: function(){}, stroke: function(){},
          strokeRect: function(){}, strokeText: function(){},
          transform: function(){}, translate: function(){},
          arc: function(){}, beginPath: function(){},
          bezierCurveTo: function(){}, closePath: function(){},
          ellipse: function(){}, arcTo: function(){}
        };
      }
    };
  },
  DOMMatrix: function() {
    return {
      is2D: true, isIdentity: true, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
      m11: 1, m12: 0, m13: 0, m14: 0, m21: 0, m22: 1, m23: 0, m24: 0,
      m31: 0, m32: 0, m33: 1, m34: 0, m41: 0, m42: 0, m43: 0, m44: 1,
      namedSides: null, affine: true, invertible: true, isSingleton: false
    };
  },
  Path2D: function() {},
  PNGReader: function() {}
};
`);
console.log('Canvas stub written to', canvasPath);