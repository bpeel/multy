function Choco ()
{
  this.canvas = document.getElementById ("glcanvas");
  this.gl = null;

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
  0.0, 1.0,
  -1.0, -1.0,
  1.0, -1.0
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

Choco.prototype.shaderSuccessCb = function (shadersString)
{
  var gl = this.gl;
  var shaders = shadersString.split ("//@@");

  this.program = this.createProgram (shaders[0], shaders[1]);

  if (this.program == null)
    return;

  this.positionAttrib = gl.getAttribLocation (this.program, "position");

  this.triangleBuffer = gl.createBuffer ();
  gl.bindBuffer (gl.ARRAY_BUFFER, this.triangleBuffer);
  gl.bufferData (gl.ARRAY_BUFFER,
                 new Float32Array (Choco.triangleVertices),
                 gl.STATIC_DRAW);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);

  this.paint ();
};

Choco.prototype.paint = function ()
{
  var gl = this.gl;

  gl.clearColor (0.0, 0.0, 0.0, 1.0);
  gl.clear (gl.COLOR_BUFFER_BIT);

  gl.bindBuffer (gl.ARRAY_BUFFER, this.triangleBuffer);
  gl.vertexAttribPointer (this.positionAttrib,
                          2, /* size */
                          gl.FLOAT,
                          false, /* normalize */
                          0, /* stride */
                          0 /* pointer */);
  gl.bindBuffer (gl.ARRAY_BUFFER, null);

  gl.useProgram (this.program);

  gl.enableVertexAttribArray (this.positionAttrib);

  gl.drawArrays (gl.TRIANGLE_STRIP, 0, 3);

  gl.disableVertexAttribArray (this.positionAttrib);

  gl.useProgram (null);
};

(function ()
 {
   function init ()
   {
     var choco = new Choco ();
   }

   $(window).load (init);
 }) ();
