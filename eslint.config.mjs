export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        setTimeout: "readonly",
        requestAnimationFrame: "readonly",
        FileReader: "readonly",
        Quill: "readonly",
        mammoth: "readonly",
        FormData: "readonly",
        JSON: "readonly",
        Array: "readonly",
        Object: "readonly",
        String: "readonly",
        Date: "readonly",
        Math: "readonly",
        parseInt: "readonly",
        isNaN: "readonly",
        encodeURIComponent: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-redeclare": "warn",
      "no-constant-condition": "warn",
      "no-empty": "warn"
    }
  }
];
