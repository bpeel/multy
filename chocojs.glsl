attribute vec2 position;

void
main ()
{
  gl_Position = vec4 (position, 0.0, 1.0);
}

//@@

void
main ()
{
  gl_FragColor = vec4 (1.0, 0.0, 0.0, 1.0);
}