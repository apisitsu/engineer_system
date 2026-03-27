module.exports = {
  resolve: {
    fallback: {
      assert: require.resolve("assert"),
      buffer: require.resolve('buffer')
    },
  },
};  
