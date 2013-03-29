uniform vec2 scale;

attribute vec2 position_attrib;
attribute vec2 tex_coord_attrib;

varying mediump vec2 tex_coord;

void
main ()
{
  gl_Position = vec4 (position_attrib * scale, 0.0, 1.0);
  tex_coord = tex_coord_attrib;
}

//@@

uniform sampler2D tex;
varying mediump vec2 tex_coord;

void
main ()
{
  gl_FragColor = vec4 (texture2D (tex, tex_coord).rgb, 1.0);
}
