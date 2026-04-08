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
        // 使用项目内图标作为 Windows 应用/安装包图标
        icon: "src/assets/logo.png",
        win: {
          target: [
            "nsis",
            "portable"
          ]
        },
        // 把托盘图标资源打进最终产物（生产环境从 process.resourcesPath 读取）
        extraResources: [
          {
            from: "src/assets/logo.png",
            to: "tray-logo.png"
          }
        ],
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
