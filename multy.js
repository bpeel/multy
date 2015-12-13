Multy.VERTEX_SIZE = 4; /* number of floats in a vertex */
Multy.N_CHUNKS = 5; /* number of chunks of multylate */
Multy.BUFFER_SIZE = Multy.VERTEX_SIZE * Multy.N_CHUNKS * 4;
Multy.ANIMATION_LENGTH = 3000.0;
Multy.CHUNK_WIDTH = 0.083;
Multy.CHUNK_HEIGHT = 0.125;
Multy.N_BITES = 4;
Multy.BITES_GAP = 1.0 / 128.0;

function Multy ()
{
  var i;

  this.canvas = document.getElementById ("glcanvas");
  this.gl = null;
  this.redrawQueued = false;
  this.buffer = new ArrayBuffer (Multy.BUFFER_SIZE * 4);

  this.chunks = new Array (Multy.N_CHUNKS);

  this.chunks[0] = new Float32Array (this.buffer, 0, Multy.VERTEX_SIZE * 4);

  this.baseX = 0.98 - Multy.CHUNK_WIDTH * 5.0;
  this.baseY = 0.02;

  for (i = 1; i < Multy.N_CHUNKS; i++)
  {
    this.chunks[i] =
      new Float32Array (this.buffer,
                        this.chunks[i - 1].byteOffset +
                        this.chunks[i - 1].byteLength,
                        Multy.VERTEX_SIZE * 4);
  }

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
    var ajax = $.ajax ("multyjs.glsl", { dataType: "text" });
    ajax.success (this.shaderSuccessCb.bind (this));
    ajax.error (this.shaderErrorCb.bind (this));
  }
}

Multy.images = [
  "multylate-piece.png",
  "bites.png"
];

Multy.prototype.showError = function (text)
{
  var errorElem = document.getElementById ("errordiv");
  var parent = this.canvas.parentNode;

  this.canvas.removeChild (errorElem);
  parent.replaceChild (errorElem, this.canvas);

  errorElem = document.getElementById ("errortext");
  var node = document.createTextNode (text);
  errorElem.appendChild (node);
};

Multy.prototype.shaderErrorCb = function (xhr, textStatus)
{
  this.showError ("Failed to load shaders: " + textStatus);
};

Multy.prototype.createShader = function (type, source)
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

Multy.prototype.createProgram = function (vertexSource, fragmentSource)
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

Multy.prototype.imageToTexture = function (img)
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
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture (gl.TEXTURE_2D, null);

  return tex;
};

Multy.prototype.finishedLoadingImages = function ()
{
  var gl = this.gl;

  gl.bindTexture (gl.TEXTURE_2D, this.textures[1]);
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri (gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture (gl.TEXTURE_2D, null);

  this.queueRedraw ();
};

Multy.requestAnimationFrame =
  (window.requestAnimationFrame ||
   window.webkitRequestAnimationFrame ||
   window.mozRequestAnimationFrame ||
   window.oRequestAnimationFrame ||
   window.msRequestAnimationFrame ||
   function(callback)
   {
     window.setTimeout(callback, 1000.0 / 60.0);
   }).bind (window);

Multy.prototype.queueRedraw = function ()
{
  if (this.redrawQueued)
    return;

  Multy.requestAnimationFrame (this.paint.bind (this));

  this.redrawQueued = true;
};

Multy.prototype.loadImages = function ()
{
  var loadedImages = 0;

  this.textures = [];

  for (i = 0; i < Multy.images.length; i++)
    {
      var img = new Image ();

      $(img).load (function (imageNum, img)
                   {
                     this.textures[imageNum] = this.imageToTexture (img);

                     if (++loadedImages >= Multy.images.length)
                       this.finishedLoadingImages ();
                   }.bind (this, i, img));
      img.src = Multy.images[i];
    }
};

Multy.prototype.createQuadElements = function (nQuads)
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

Multy.prototype.shaderSuccessCb = function (shadersString)
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
  this.elementBuffer = this.createQuadElements (Multy.N_CHUNKS);
};

Multy.prototype.updateTransform = function ()
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

Multy.prototype.setChunk = function (chunk, x, y, coords)
{
  var i;

  x -= coords[0] * Multy.CHUNK_WIDTH;
  y -= coords[1] * Multy.CHUNK_HEIGHT;

  for (i = 0; i < 4; i++)
  {
    var dx = coords[i * 2];
    var dy = coords[i * 2 + 1];
    chunk[i * 4 + 0] = x + dx * Multy.CHUNK_WIDTH;
    chunk[i * 4 + 1] = y + dy * Multy.CHUNK_HEIGHT;
    chunk[i * 4 + 2] = dx;
    chunk[i * 4 + 3] = dy;
  }
};

Multy.ANIMATIONS =
  [
    [
      [ 0, 4,
        [ 0, 0, 1, 0, 1, 1, 0, 1 ] ],
      [ 1, 4,
        [ 0, 0, 2, 0, 2, 1, 0, 1 ] ],
      [ 0, 1.5,
        [ 0, 1.5, 3, 2.7, 3, 4, 0, 4 ] ],
      [ 3, 2.7,
        [ 0, 2.7, 2, 3.5, 2, 5, 0, 5 ] ],
      [ 0, 0,
        [ 0, 0, 5, 0, 5, 3.5, 0, 1.5 ] ]
    ],
    [
      [ -0.5, 5.10,
        [ 0, 0, 1, 0, 1, 1, 0, 1 ] ],
      [ 0.8, 5.10,
        [ 0, 0, 2, 0, 2, 1, 0, 1 ] ],
      [ 0, 1.65,
        [ 0, 1.5, 3, 2.7, 3, 4, 0, 4 ] ],
      [ 3, 4.77,
        [ 0, 2.7, 2, 3.5, 2, 5, 0, 5 ] ],
      null
    ],
    [
      [ -3.5, 5.10,
        [ 0, 0, 1, 0, 1, 1, 0, 1 ] ],
      [ -2.2, 5.10,
        [ 0, 0, 2, 0, 2, 1, 0, 1 ] ],
      [ 2, 2.3,
        [ 0, 1.3, 3, 2.5, 3, 4, 0, 4 ] ],
      [ 0, 4.77,
        [ 0, 2.7, 2, 3.5, 2, 5, 0, 5 ] ],
      null
    ],
    [
      null,
      null,
      null,
      [ 0, 1.5,
        [ 0, 2.5, 2, 3.3, 2, 5, 0, 5 ] ],
      null
    ],
    [
      [ -2, 4,
        [ 0, 0, 1, 0, 1, 1, 0, 1 ] ],
      [ 0, 4,
        [ 0, 0, 2, 0, 2, 1, 0, 1 ] ],
      null,
      null,
      null
    ],
  ];

Multy.prototype.interpolate = function (stateA, stateB, interval)
{
  var result = new Array (stateA.length);
  var i;

  for (i = 0; i < stateA.length; i++)
  {
    if (typeof (stateA[i]) == "object")
      result[i] = this.interpolate (stateA[i], stateB[i], interval);
    else
      result[i] = (stateB[i] - stateA[i]) * interval + stateA[i];
  }

  return result;
}

Multy.prototype.updateTime = function ()
{
  var now = (new Date ()).getTime ();

  if (!this.startTime)
    this.startTime = now;

  var animationPos = (now - this.startTime) / Multy.ANIMATION_LENGTH;
  animationPos -= Math.floor (animationPos);
  this.statePos = animationPos * Multy.ANIMATIONS.length;
  this.stateNum = Math.floor (this.statePos);
  this.statePos -= this.stateNum;
};

Multy.prototype.updateChunkBufferForBites = function ()
{
  /* The first quad will just be the entire multylate bar */
  this.setChunk (this.chunks[0],
                 this.baseX, this.baseY,
                 [ 0, 0, 5, 0, 5, 5, 0, 5 ]);

  /* The second chunk will be the biting animation */
  var biteChunk = this.chunks[1];
  this.setChunk (biteChunk,
                 this.baseX - 2 * Multy.CHUNK_WIDTH,
                 this.baseY + 4 * Multy.CHUNK_HEIGHT,
                 [ 0, 0, 1, 0, 1, 1, 0, 1 ]);

  var biteNum = Math.floor (this.statePos * Multy.N_BITES);
  var biteSize = 1.0 / Multy.N_BITES;
  biteChunk[2] = biteNum * biteSize;
  biteChunk[6] = (biteNum + 1) * biteSize - Multy.BITES_GAP;
  biteChunk[10] = (biteNum + 1) * biteSize - Multy.BITES_GAP;
  biteChunk[14] = biteNum * biteSize;
};

Multy.prototype.updateChunkBufferForAnimations = function ()
{
  var gl = this.gl;
  var i;

  for (i = 0; i < Multy.N_CHUNKS; i++)
  {
    var oldStateNum, oldState, nextState, newState;

    for (oldStateNum = this.stateNum;
         !(oldState = Multy.ANIMATIONS[oldStateNum][i]);
         oldStateNum--);
    nextState = Multy.ANIMATIONS[this.stateNum + 1][i];

    if (nextState == null)
      newState = oldState;
    else
      newState = this.interpolate (oldState, nextState, this.statePos);

    this.setChunk (this.chunks[i],
                   this.baseX + newState[0] * Multy.CHUNK_WIDTH,
                   this.baseY + newState[1] * Multy.CHUNK_HEIGHT,
                   newState[2]);
  }
};

Multy.prototype.paint = function ()
{
  var gl = this.gl;

  this.updateTime ();

  if (this.stateNum == Multy.ANIMATIONS.length - 1)
    this.updateChunkBufferForBites ();
  else
    this.updateChunkBufferForAnimations ();


  gl.bindBuffer (gl.ARRAY_BUFFER, this.chunkBuffer);
  gl.bufferData (gl.ARRAY_BUFFER, this.buffer, gl.DYNAMIC_DRAW);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);

  gl.useProgram (this.program);

  gl.clearColor (1.0, 1.0, 1.0, 1.0);
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

  gl.enableVertexAttribArray (this.positionAttrib);
  gl.enableVertexAttribArray (this.texCoordAttrib);

  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, this.elementBuffer);

  if (this.stateNum == Multy.ANIMATIONS.length - 1)
  {
    gl.bindTexture (gl.TEXTURE_2D, this.textures[0]);
    gl.drawElements (gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, 0);

    gl.bindTexture (gl.TEXTURE_2D, this.textures[1]);
    gl.drawElements (gl.TRIANGLES,
                     6,
                     gl.UNSIGNED_BYTE,
                     6);
  }
  else
  {
    gl.bindTexture (gl.TEXTURE_2D, this.textures[0]);
    gl.drawElements (gl.TRIANGLES, Multy.N_CHUNKS * 6, gl.UNSIGNED_BYTE, 0);
  }

  gl.bindTexture (gl.TEXTURE_2D, null);

  gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, null);

  gl.disableVertexAttribArray (this.texCoordAttrib);
  gl.disableVertexAttribArray (this.positionAttrib);

  gl.useProgram (null);

  this.redrawQueued = false;
  this.queueRedraw ();
};

(function ()
 {
   function init ()
   {
     var multy = new Multy ();
   }

   $(window).load (init);
 }) ();
