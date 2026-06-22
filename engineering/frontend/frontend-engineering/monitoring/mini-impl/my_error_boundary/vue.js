const app = require("vue");

app.config.errorHandler = (e, instance, info) => {
  reportError({
    type: "vue_error",
    message: err.message,
    stack: err.stack,
    component: instance?.$options?.name,
    info,
  });
};
