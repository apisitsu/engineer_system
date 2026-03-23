import React from "react";
import { shallow } from "enzyme";
import Sign_up from "./sign_up";

describe("Sign_up", () => {
  test("matches snapshot", () => {
    const wrapper = shallow(<Sign_up />);
    expect(wrapper).toMatchSnapshot();
  });
});
