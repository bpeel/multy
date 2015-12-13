const float PI = 3.14159265358979323846264338327950288419716939937;

uniform vec2 scale;
uniform float multiplier;
uniform float n_points;

attribute float vertex_id;

void
main ()
{
        float point;

        if (fract(vertex_id) > 0.25)
                point = multiplier * floor(vertex_id);
        else
                point = vertex_id;

        float angle = point * 2.0 * PI / n_points;
        float x = sin(angle);
        float y = cos(angle);

        gl_Position = vec4(vec2(x, y) * scale, 0.0, 1.0);
}

//@@

void
main ()
{
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
