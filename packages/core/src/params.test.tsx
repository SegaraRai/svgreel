import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import { compile } from "./compiler/compile.js";
import { defineParams, describeParams, param, parseParamValue, resolveParams, type ParamsOf } from "./params.js";
import { defineComposition, useParams } from "./timeline.js";

const schema = defineParams({
  accent: param.color((v) => (v.theme === "dark" ? "#ffffff" : "#111111")),
  speed: param.number(1, { min: 0.5, max: 2, step: 0.1, label: "Speed" }),
  grid: param.boolean(true),
  title: param.text("Hello"),
  align: param.select(["left", "center", "right"], "center"),
});

describe("params", () => {
  it("types the values from the schema", () => {
    expectTypeOf<ParamsOf<typeof schema>>().toEqualTypeOf<{
      readonly accent: string;
      readonly speed: number;
      readonly grid: boolean;
      readonly title: string;
      readonly align: "left" | "center" | "right";
    }>();
  });

  it("resolves defaults, per variant where the default is a function", () => {
    expect(resolveParams(schema, { theme: "dark", motion: "default" })).toEqual({
      accent: "#ffffff",
      speed: 1,
      grid: true,
      title: "Hello",
      align: "center",
    });
    expect(resolveParams(schema, { theme: "light", motion: "default" }).accent).toBe("#111111");
  });

  it("applies overrides and checks them", () => {
    expect(resolveParams(schema, { motion: "default" }, { speed: 2, align: "left" })).toMatchObject({
      speed: 2,
      align: "left",
    });
    expect(() => resolveParams(schema, { motion: "default" }, { speed: 3 })).toThrow(/outside 0.5…2/);
    expect(() => resolveParams(schema, { motion: "default" }, { align: "top" })).toThrow(/not one of/);
    expect(() => resolveParams(schema, { motion: "default" }, { accent: "nope" })).toThrow(/Unsupported color/);
    expect(() => resolveParams(schema, { motion: "default" }, { nope: 1 })).toThrow(/Unknown param "nope"/);
    expect(() => resolveParams({ "1x": param.number(1) }, { motion: "default" })).toThrow(/Invalid param key/);
  });

  it("parses command-line values by kind", () => {
    expect(parseParamValue("speed", schema.speed, "1.5")).toBe(1.5);
    expect(parseParamValue("grid", schema.grid, "false")).toBe(false);
    expect(parseParamValue("accent", schema.accent, "#f00")).toBe("#f00");
    expect(() => parseParamValue("speed", schema.speed, "")).toThrow(/expected a number/);
    expect(() => parseParamValue("grid", schema.grid, "yes")).toThrow(/true or false/);
  });

  it("describes the schema without defaults", () => {
    expect(describeParams(schema)).toEqual([
      { key: "accent", kind: "color" },
      { key: "speed", kind: "number", min: 0.5, max: 2, step: 0.1, label: "Speed" },
      { key: "grid", kind: "boolean" },
      { key: "title", kind: "text" },
      { key: "align", kind: "select", options: ["left", "center", "right"] },
    ]);
  });

  it("passes the values to useParams() when compiling", () => {
    const params = defineParams({ fill: param.color("#ff0000") });
    const comp = defineComposition({
      component: () => {
        const { fill } = useParams<typeof params>();
        return (
          <svg viewBox="0 0 10 10">
            <rect width={10} height={10} fill={fill} />
          </svg>
        );
      },
      params,
      width: 10,
      height: 10,
      fps: 30,
      durationInFrames: 2,
    });
    const res = compile(comp, { motion: "default" }, { fill: "#00ff00" });
    expect(res.svg).toContain(`fill="#00ff00"`);
    expect(res.params).toEqual({ fill: "#00ff00" });
    expect(compile(comp).svg).toContain(`fill="#ff0000"`);
  });
});
