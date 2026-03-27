import React, { useState } from "react";
import { server } from "./../../../constance/constance";
import axios from "axios";
import Swal from "sweetalert2";
import { Layout } from 'antd';
import './sign_up.css'

const { Content, Footer } = Layout;

function Sign_up() {
  const [state, setState] = useState({
    empno: null,
    empname: null,
    password: null,
    confirmPassword: null,
    eventId: "regist",
    auth: "4",
  });

  const handleInputChange = (e) => {
    setState({
      ...state,
      [e.target.id]: e.target.value,
    });
  };

  const handleSubmitClick = async (e) => {
    e.preventDefault();
    // console.log(state);
    if (state.password === state.confirmPassword) {
      await axios.post(server.PHP_USER, JSON.stringify(state)).then(function (res) {
        // console.log(res);
        if (res.data.result !== "-1") {
          const Toast = Swal.mixin({
            toast: true,
            position: "center",
            showConfirmButton: false,
            timer: 600,
            timerProgressBar: true,
            didOpen: (toast) => {
              toast.onmouseenter = Swal.stopTimer;
              toast.onmouseleave = Swal.resumeTimer;
            }
          });
          Toast.fire({
            icon: "success",
            title: "Registration successfully"
          }).then(function () {
            window.location = "/sign_in";
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Oops...",
            text: `Emp.No ${state.empno} registration already`,
          })
        }
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Password not match!!!",
      });
    }
  };

  const toInputUppercase = e => {
    e.target.value = ("" + e.target.value).toUpperCase();
  };

  return (
    <Layout>
      <Content style={{ paddingTop: "5%" }}>
        <div className="container-home" id="container">
          <div className="form-up-container sign-up-container">
            <form>
              <h1><i className="fas fa-plane fa-rotate-180" /> Registration <i className="fas fa-plane" /></h1>
              <br />
              <div className="input-group mb-2">
                <div className="input-group-prepend">
                  <div className="input-group-text icon-style-area"><i className="fas fa-edit icon-style" /></div>
                </div>
                <input className="form-control" id="empname" type="empname" placeholder="Full Name" onChange={(e) => handleInputChange(e)} />
              </div>
              <div className="input-group mb-2">
                <div className="input-group-prepend">
                  <div className="input-group-text icon-style-area"><i className="fas fa-user-circle icon-style" /></div>
                </div>
                <input className="form-control" id="empno" type="empno" placeholder="Emp No." maxLength={10} onChange={(e) => handleInputChange(e)} onInput={toInputUppercase}/>
              </div>
              <div className="input-group mb-2">
                <div className="input-group-prepend">
                  <div className="input-group-text icon-style-area"><i className="fas fa-lock icon-style" /></div>
                </div>
                <input className="form-control" id="password" type="password" placeholder="Password" onChange={(e) => handleInputChange(e)} />
              </div>
              <div className="input-group mb-2">
                <div className="input-group-prepend">
                  <div className="input-group-text icon-style-area"><i className="fas fa-lock icon-style" /></div>
                </div>
                <input className="form-control" id="confirmPassword" type="password" placeholder="Confirm Password" onChange={(e) => handleInputChange(e)} />
              </div>
              <p>Already have an account?<a href="/sign_in"> Sign In.</a></p>
              <button onClick={handleSubmitClick}>Register</button>
            </form>
          </div>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        © 2022 - 2024 RODEND Internal Gateway System.
      </Footer>
    </Layout>
  );
}
export default Sign_up;
