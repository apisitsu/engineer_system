import React from "react";
import { shallow } from "enzyme";
import Sign_up from "./sign_up";

describe("Sign_up", () => {
  test("matches snapshot", () => {
    // eslint-disable-next-line react/jsx-pascal-case
    const wrapper = shallow(<Sign_up />);
    expect(wrapper).toMatchSnapshot();
  });
});
