const HtmlTransform = require('./lib/transform-html.js')
const JsTransform = require('./lib/transform-js.js').jsTransformStream
const CssTransform = require('./lib/transform-css.js')
const generateEnvironment = require('./lib/env-gen.js')

module.exports = {
  HtmlTransform: HtmlTransform,
  JsTransform: JsTransform,
  CssTransform: CssTransform,
  generateEnvironment: generateEnvironment,
}