function Multy()
{
  var i;

  this.canvas = document.getElementById("glcanvas");
  this.gl = null;
  this.redrawQueued = false;
  this.buffer = null;

  this.n_points = 100;

  try
  {
    var attribs = { depth: false };

    this.gl = (this.canvas.getContext("webgl", attribs) ||
               this.canvas.getContext("experimental-webgl", attribs));
  }
  catch (e)
  {
  }

  if (this.gl == null)
  {
    this.showError("Your browser doesn't appear to support WebGL");
  }
  else
  {
    var ajax = $.ajax("multy.glsl", { dataType: "text" });
    ajax.success(this.shaderSuccessCb.bind(this));
    ajax.error(this.shaderErrorCb.bind(this));
  }
}

Multy.ANIMATION_LENGTH = 60000.0;

Multy.prototype.showError = function(text)
{
  var errorElem = document.getElementById("errordiv");
  var parent = this.canvas.parentNode;

  this.canvas.removeChild(errorElem);
  parent.replaceChild(errorElem, this.canvas);

  errorElem = document.getElementById("errortext");
  var node = document.createTextNode(text);
  errorElem.appendChild(node);
};

Multy.prototype.shaderErrorCb = function(xhr, textStatus)
{
  this.showError("Failed to load shaders: " + textStatus);
};

Multy.prototype.createShader = function(type, source)
{
  var gl = this.gl;

  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    return shader;

  this.showError(gl.getShaderInfoLog(shader));

  return null;
};

Multy.prototype.createProgram = function(vertexSource, fragmentSource)
{
  var gl = this.gl;

  var vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);

  if(vertexShader == null)
    return null;

  var fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

  if (fragmentShader == null)
    return null;

  var program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (gl.getProgramParameter(program, gl.LINK_STATUS))
    return program;

  this.showError(gl.getProgramInfoLog(program));

  return null;
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
   }).bind(window);

Multy.prototype.queueRedraw = function()
{
  if (this.redrawQueued)
    return;

  Multy.requestAnimationFrame(this.paint.bind(this));

  this.redrawQueued = true;
};

Multy.prototype.updateBuffer = function()
{
  var gl = this.gl;
  var vert_data = new Float32Array(this.n_points * 2);
  var i;

  if (this.buffer)
    gl.deleteBuffer(this.buffer);

  for (i = 0; i < this.n_points; i++)
  {
    vert_data[i * 2] = i;
    vert_data[i * 2 + 1] = i + 0.5;
  }

  this.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vert_data, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  var n_points_uniform = gl.getUniformLocation(this.program, "n_points");
  gl.useProgram(this.program);
  gl.uniform1f(n_points_uniform, this.n_points);
  gl.useProgram(null);
};

Multy.prototype.shaderSuccessCb = function(shadersString)
{
  var gl = this.gl;
  var shaders = shadersString.split("//@@");
  var i;

  this.program = this.createProgram(shaders[0], shaders[1]);

  if (this.program == null)
    return;

  this.vertexIdAttrib = gl.getAttribLocation(this.program, "vertex_id");
  this.multiplierUniform = gl.getUniformLocation(this.program, "multiplier");

  this.updateTransform();
  this.updateBuffer();
  this.queueRedraw();
};

Multy.prototype.updateTransform = function()
{
  var gl = this.gl;
  var w = this.canvas.width;
  var h = this.canvas.height;
  var scaleUniform = gl.getUniformLocation(this.program, "scale");
  var scale;

  if (w > h)
    scale = [ h / w, 1.0 ];
  else
    scale = [ 1.0, w / h ];

  gl.useProgram(this.program);
  gl.uniform2fv(scaleUniform, scale);
  gl.useProgram(null);
};

Multy.prototype.updateTime = function()
{
  var now = (new Date()).getTime();

  if (!this.startTime)
    this.startTime = now;

  this.animationPos = (now - this.startTime) / Multy.ANIMATION_LENGTH;
  this.animationPos -= Math.floor(this.animationPos);
};

Multy.prototype.paint = function()
{
  var gl = this.gl;

  this.updateTime();

  gl.useProgram(this.program);

  gl.uniform1f(this.multiplierUniform, this.animationPos * this.n_points);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
  gl.vertexAttribPointer(this.vertexIdAttrib,
                         1, /* size */
                         gl.FLOAT,
                         false, /* normalize */
                         4, /* stride */
                         0 /* offset */);
  gl.enableVertexAttribArray(this.vertexIdAttrib);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.drawArrays(gl.LINES, 0, this.n_points * 2);

  gl.disableVertexAttribArray(this.vertexIdAttrib);
  gl.useProgram(null);

  this.redrawQueued = false;
  this.queueRedraw();
};

(function()
 {
   function init()
   {
     var multy = new Multy();
   }

   $(window).load(init);
 })();
