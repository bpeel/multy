function Choco ()
{
  this.canvas = document.getElementById ("glcanvas");
  this.gl = null;
  this.redrawQueued = false;

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

Choco.triangleVertices = [
  0.0, 1.0,    0.5, 1.0,
  -1.0, -1.0,  0.0, 0.0,
  1.0, -1.0,   1.0, 0.0
];

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

  this.triangleBuffer = gl.createBuffer ();
  gl.bindBuffer (gl.ARRAY_BUFFER, this.triangleBuffer);
  gl.bufferData (gl.ARRAY_BUFFER,
                 new Float32Array (Choco.triangleVertices),
                 gl.STATIC_DRAW);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);
};

Choco.prototype.updateTransform = function ()
{
  var gl = this.gl;
  var w = this.canvas.width;
  var h = this.canvas.height;
  var scaleUniform = gl.getUniformLocation (this.program, "scale");
  var scale;

  if (w > h)
    scale = [ h / w, 1.0 ];
  else
    scale = [ 1.0, w / h ];

  gl.useProgram (this.program);
  gl.uniform2fv (scaleUniform, scale);
  gl.useProgram (null);
};

Choco.prototype.paint = function ()
{
  var gl = this.gl;

  gl.useProgram (this.program);

  gl.clearColor (0.0, 0.0, 0.0, 1.0);
  gl.clear (gl.COLOR_BUFFER_BIT);

  gl.bindBuffer (gl.ARRAY_BUFFER, this.triangleBuffer);
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

  gl.drawArrays (gl.TRIANGLE_STRIP, 0, 3);

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
