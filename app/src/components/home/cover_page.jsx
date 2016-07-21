'use strict';
import React, {Component} from "react";
import $ from "jquery";
import ButtonBoxSlider from "./button_box_slider";
import cover_page from "../../../styles/components/c_cover_page.scss";
import box_triangle from "../../../styles/components/c_box_triangle.scss";

class CoverPage extends Component {
  gosection() {
    $('html, body').animate({
      scrollTop: $("#case_study").offset().top
    }, 1000);
  }

  render() {
    return <section className={cover_page.c_cover_page}>
      <div>
        <h1>
          The first global view of commercial fishing activity
        </h1>
        <p>Global Fishing Watch, a partnership of Oceana, SkyTruth and Google, enables anyone with an Internet
          connection to see global fishing activity worldwide in near real-time - for free. It s a powerful tool that
          will hold our leaders accountable for maintaining abundant oceans and show consumers where - - and by whom --
          their fish is being caught.</p>
        <div className={cover_page.footer_header}>
          <ButtonBoxSlider></ButtonBoxSlider>
          <div className={box_triangle.c_box_triangle} onClick={this.gosection}>
            <div className={box_triangle.triangle_min}></div>
          </div>
          <div>Brought to you by:</div>
        </div>
      </div>
    </section>
  }
}

export default CoverPage;