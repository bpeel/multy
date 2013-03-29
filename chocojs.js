Choco.VERTEX_SIZE = 4; /* number of floats in a vertex */
Choco.N_CHUNKS = 5; /* number of chunks of chocolate */
Choco.BUFFER_SIZE = Choco.VERTEX_SIZE * Choco.N_CHUNKS * 4;
Choco.ANIMATION_LENGTH = 3000.0;
Choco.CHUNK_WIDTH = 0.083;
Choco.CHUNK_HEIGHT = 0.125;

function Choco ()
{
  var i;

  this.canvas = document.getElementById ("glcanvas");
  this.gl = null;
  this.redrawQueued = false;
  this.buffer = new ArrayBuffer (Choco.BUFFER_SIZE * 4);

  var chunks = new Array (Choco.N_CHUNKS);

  chunks[0] = new Float32Array (this.buffer, 0, Choco.VERTEX_SIZE * 4);

  for (i = 1; i < Choco.N_CHUNKS; i++)
  {
    chunks[i] =
      new Float32Array (this.buffer,
                        chunks[i - 1].byteOffset +
                        chunks[i - 1].byteLength,
                        Choco.VERTEX_SIZE * 4);
  }

  this.smallChunk = chunks[0];
  this.bigChunk = chunks[1];
  this.leftChunk = chunks[2];
  this.rightChunk = chunks[3];
  this.bottomChunk = chunks[4];

  try
  {
    var attribs = { depth: false };

    this.gl = (this.canvas.getContext ("webgl", attribs) ||
               this.canvas.getContext ("experimental-webgl", attribs));
  }
  catch (e)
  {
  }

  if (this.gl == null)
  {
    this.showError ("Your browser doesn't appear to support WebGL");
  }
  else
  {
    var ajax = $.ajax ("chocojs.glsl", { dataType: "text" });
    ajax.success (this.shaderSuccessCb.bind (this));
    ajax.error (this.shaderErrorCb.bind (this));
  }
}

Choco.images = [
  "chocolate-piece.png"
];

Choco.prototype.showError = function (text)
{
  var errorElem = document.getElementById ("errordiv");
  var parent = this.canvas.parentNode;

  this.canvas.removeChild (errorElem);
  parent.replaceChild (errorElem, this.canvas);

  errorElem = document.getElementById ("errortext");
  var node = document.createTextNode (text);
  errorElem.appendChild (node);
};

Choco.prototype.shaderErrorCb = function (xhr, textStatus)
{
  this.showError ("Failed to load shaders: " + textStatus);
};

Choco.prototype.createShader = function (type, source)
{
  var gl = this.gl;

  var shader = gl.createShader (type);
  gl.shaderSource (shader, source);
  gl.compileShader (shader);

  if (gl.getShaderParameter (shader, gl.COMPILE_STATUS))
    return shader;

  this.showError (gl.getShaderInfoLog (shader));

  return null;
};

Choco.prototype.createProgram = function (vertexSource, fragmentSource)
{
  var gl = this.gl;

  var vertexShader = this.createShader (gl.VERTEX_SHADER, vertexSource);

  if (vertexShader == null)
    return null;

  var fragmentShader = this.createShader (gl.FRAGMENT_SHADER, fragmentSource);

  if (fragmentShader == null)
    return null;

  var program = gl.createProgram ();

  gl.attachShader (program, vertexShader);
  gl.attachShader (program, fragmentShader);
  gl.linkProgram (program);

  if (gl.getProgramParameter (program, gl.LINK_STATUS))
    return program;

  this.showError (gl.getProgramInfoLog (program));

  return null;
};

Choco.prototype.imageToTexture = function (img)
{
  var gl = this.gl;
  var tex = gl.createTexture ();

  gl.bindTexture (gl.TEXTURE_2D, tex);
  gl.texImage2D (gl.TEXTURE_2D,
                 0 /* level */,
                 gl.RGB /* format */,
                 gl.RGB /* internalFormat */,
                 gl.UNSIGNED_BYTE,
                 img);
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture (gl.TEXTURE_2D, null);

  return tex;
};

Choco.prototype.finishedLoadingImages = function ()
{
  this.queueRedraw ();
};

Choco.requestAnimationFrame =
  (window.requestAnimationFrame ||
   window.webkitRequestAnimationFrame ||
   window.mozRequestAnimationFrame ||
   window.oRequestAnimationFrame ||
   window.msRequestAnimationFrame ||
   function(callback)
   {
     window.setTimeout(callback, 1000.0 / 60.0);
   }).bind (window);

Choco.prototype.queueRedraw = function ()
{
  if (this.redrawQueued)
    return;

  Choco.requestAnimationFrame (this.paint.bind (this));

  this.redrawQueued = true;
};

Choco.prototype.loadImages = function ()
{
  var loadedImages = 0;

  this.textures = [];

  for (i = 0; i < Choco.images.length; i++)
    {
      var img = new Image ();

      $(img).load (function (imageNum, img)
                   {
                     this.textures[imageNum] = this.imageToTexture (img);

                     if (++loadedImages >= Choco.images.length)
                       this.finishedLoadingImages ();
                   }.bind (this, i, img));
      img.src = Choco.images[i];
    }
};

Choco.prototype.createQuadElements = function (nQuads)
{
  var gl = this.gl;
  var byteArray = new Uint8Array (nQuads * 6);
  var vertNum = 0;
  var bytePos = 0;
  var i;

  for (i = 0; i < nQuads; i++)
  {
    byteArray[bytePos++] = vertNum + 0;
    byteArray[bytePos++] = vertNum + 1;
    byteArray[bytePos++] = vertNum + 2;
    byteArray[bytePos++] = vertNum + 0;
    byteArray[bytePos++] = vertNum + 2;
    byteArray[bytePos++] = vertNum + 3;
    vertNum += 4;
  }

  var buffer = gl.createBuffer ();
  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData (gl.ELEMENT_ARRAY_BUFFER, byteArray, gl.STATIC_DRAW);
  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, null);

  return buffer;
};

Choco.prototype.shaderSuccessCb = function (shadersString)
{
  var gl = this.gl;
  var shaders = shadersString.split ("//@@");
  var i;

  this.program = this.createProgram (shaders[0], shaders[1]);

  if (this.program == null)
    return;

  this.positionAttrib = gl.getAttribLocation (this.program, "position_attrib");
  this.texCoordAttrib = gl.getAttribLocation (this.program, "tex_coord_attrib");

  var texUniform = gl.getUniformLocation (this.program, "tex");
  gl.useProgram (this.program);
  gl.uniform1i (texUniform, 0);
  gl.useProgram (null);

  this.updateTransform ();
  this.loadImages ();

  this.chunkBuffer = gl.createBuffer ();
  this.elementBuffer = this.createQuadElements (Choco.N_CHUNKS);
};

Choco.prototype.updateTransform = function ()
{
  var gl = this.gl;
  var w = this.canvas.width;
  var h = this.canvas.height;
  var scaleUniform = gl.getUniformLocation (this.program, "scale");
  var scale;

  if (w > h)
    scale = [ h / w * 2.0, 2.0 ];
  else
    scale = [ 2.0, w / h * 2.0 ];

  gl.useProgram (this.program);
  gl.uniform2fv (scaleUniform, scale);
  gl.useProgram (null);
};

Choco.prototype.setChunk = function (chunk, x, y, coords)
{
  var i;

  x -= coords[0] * Choco.CHUNK_WIDTH;
  y -= coords[1] * Choco.CHUNK_HEIGHT;

  for (i = 0; i < 4; i++)
  {
    var dx = coords[i * 2];
    var dy = coords[i * 2 + 1];
    chunk[i * 4 + 0] = x + dx * Choco.CHUNK_WIDTH;
    chunk[i * 4 + 1] = y + dy * Choco.CHUNK_HEIGHT;
    chunk[i * 4 + 2] = dx;
    chunk[i * 4 + 3] = dy;
  }
};

Choco.prototype.updateChunkBuffer = function ()
{
  var animationPos;
  var now = (new Date ()).getTime ();
  var gl = this.gl;

  if (!this.startTime)
    this.startTime = now;

  animationPos = (now - this.startTime) % Choco.ANIMATION_LENGTH;

  var bx = 0.98 - Choco.CHUNK_WIDTH * 5.0;
  var by = 0.02;

  this.setChunk (this.smallChunk,
                 bx - Choco.CHUNK_WIDTH * 0.1,
                 by + 4.5 * Choco.CHUNK_HEIGHT,
                 [ 0, 0, 1, 0, 1, 1, 0, 1 ]);

  this.setChunk (this.bigChunk,
                 bx + Choco.CHUNK_WIDTH,
                 by + 4.5 * Choco.CHUNK_HEIGHT,
                 [ 0, 0, 2, 0, 2, 1, 0, 1 ]);

  this.setChunk (this.leftChunk,
                 bx,
                 by + Choco.CHUNK_HEIGHT * 1.6,
                 [ 0, 1.5, 3, 2.7, 3, 4, 0, 4 ]);

  this.setChunk (this.rightChunk,
                 bx + Choco.CHUNK_WIDTH * 3.0,
                 by + Choco.CHUNK_HEIGHT * 3.5,
                 [ 0, 0.8, 2, 1.5, 2, 3, 0, 3 ]);

  this.setChunk (this.bottomChunk, bx, by,
                 [ 0, 0, 5, 0, 5, 3.5, 0, 1.5 ]);

  gl.bindBuffer (gl.ARRAY_BUFFER, this.chunkBuffer);
  gl.bufferData (gl.ARRAY_BUFFER, this.buffer, gl.DYNAMIC_DRAW);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);
};

Choco.prototype.paint = function ()
{
  var gl = this.gl;

  this.updateChunkBuffer ();

  gl.useProgram (this.program);

  gl.clearColor (0.0, 0.0, 0.0, 1.0);
  gl.clear (gl.COLOR_BUFFER_BIT);

  gl.bindBuffer (gl.ARRAY_BUFFER, this.chunkBuffer);
  gl.vertexAttribPointer (this.positionAttrib,
                          2, /* size */
                          gl.FLOAT,
                          false, /* normalize */
                          4 * 4, /* stride */
                          0 /* pointer */);
  gl.vertexAttribPointer (this.texCoordAttrib,
                          2, /* size */
                          gl.FLOAT,
                          false, /* normalize */
                          4 * 4, /* stride */
                          2 * 4 /* pointer */);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);

  gl.bindTexture (gl.TEXTURE_2D, this.textures[0]);

  gl.enableVertexAttribArray (this.positionAttrib);
  gl.enableVertexAttribArray (this.texCoordAttrib);

  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, this.elementBuffer);
  gl.drawElements (gl.TRIANGLES, Choco.N_CHUNKS * 6, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, null);

  gl.disableVertexAttribArray (this.texCoordAttrib);
  gl.disableVertexAttribArray (this.positionAttrib);

  gl.bindTexture (gl.TEXTURE_2D, null);

  gl.useProgram (null);

  this.redrawQueued = false;
  this.queueRedraw ();
};

(function ()
 {
   function init ()
   {
     var choco = new Choco ();
   }

   $(window).load (init);
 }) ();
