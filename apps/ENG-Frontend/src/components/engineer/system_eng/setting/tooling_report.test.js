import React from "react";
import { shallow } from "enzyme";
import Tooling_report from "./tooling_report";

describe("Tooling_report", () => {
  test("matches snapshot", () => {
    const wrapper = shallow(<Tooling_report />);
    expect(wrapper).toMatchSnapshot();
  });
});
