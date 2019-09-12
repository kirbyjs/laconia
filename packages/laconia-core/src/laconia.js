const AWS = require("aws-sdk");
const CoreLaconiaContext = require("./CoreLaconiaContext");

const checkFunction = (functionName, argument) => {
  if (typeof argument !== "function")
    throw new TypeError(
      `${functionName}() expects to be passed a function, you passed: ${JSON.stringify(
        argument
      )}`
    );
};

const awsInstances = {
  lambda: new AWS.Lambda(),
  s3: new AWS.S3(),
  ssm: new AWS.SSM(),
  sns: new AWS.SNS(),
  secretsManager: new AWS.SecretsManager()
};

module.exports = app => {
  checkFunction("laconia", app);
  const laconiaContext = new CoreLaconiaContext();
  laconiaContext.registerBuiltInInstances(awsInstances);

  const laconia = async (event, context, callback) => {
    laconiaContext.registerInstances({ event, context });
    await laconiaContext.refresh();

    try {
      const result = await app(event, laconiaContext);
      callback(null, result);
    } catch (err) {
      callback(err);
    }
  };

  return Object.assign(laconia, {
    register: (factory, optionsOrFactory, options = {}) => {
      if (typeof optionsOrFactory !== "function") {
        options = optionsOrFactory || {};
      }
      if (Array.isArray(factory)) {
        factory.forEach(f => checkFunction("register", f));
        laconiaContext.registerFactories(factory, options.cache);
      } else {
        if (typeof factory === "string") {
          checkFunction("register", optionsOrFactory);
          const factoryKey = factory;
          factory = async laconiaContext => ({
            [factoryKey]: await optionsOrFactory(laconiaContext)
          });
        }
        checkFunction("register", factory);
        laconiaContext.registerFactory(factory, options.cache);
      }
      return laconia;
    },
    postProcessor: postProcessor => {
      checkFunction("postProcessor", postProcessor);
      laconiaContext.registerPostProcessor(postProcessor);
      return laconia;
    }
  });
};
