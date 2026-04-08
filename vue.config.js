module.exports = {
  productionSourceMap: false,
  parallel: false,
  filenameHashing: false,
  devServer: {
    proxy: "http://localhost:8080"
  },
  pluginOptions: {
    electronBuilder: {
      chainWebpackRendererProcess: config => {
        config.externals({
          electron: "commonjs2 electron",
          fs: "commonjs2 fs",
          path: "commonjs2 path",
          http: "commonjs2 http",
          https: "commonjs2 https"
        });

        config.resolve.merge({
          fallback: {
            assert: false,
            buffer: false,
            child_process: false,
            crypto: false,
            fs: false,
            http: false,
            https: false,
            net: false,
            os: false,
            path: false,
            stream: false,
            tls: false,
            url: false,
            util: false,
            zlib: false
          }
        });
      },
      builderOptions: {
        nsis: {
          differentialPackage: false
        },
        directories: {
          output: "dist_electron_out"
        }
      }
    }
  }
};
