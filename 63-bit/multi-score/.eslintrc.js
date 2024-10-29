module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },

  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "no-underscore-dangle": "off",
    "no-await-in-loop": "off",
    "no-plusplus": "off",
  }
};
