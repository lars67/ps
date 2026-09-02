{
  "targets": [
    {
      "target_name": "jcalc",
      "sources": [
        "src/extmath.c",
        "src/distrib.c",
        "src/eurobs.c",
        "src/black76.c",
        "src/binomial.c",
        "src/addon.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "cflags_cc": ["-std=c++17", "-fexceptions"]
    }
  ]
}
