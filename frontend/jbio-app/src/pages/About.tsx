import React from "react";
import "./About.css";

import Profile from "../components/Profile";
import profiles from "../assets/profiles/profiles.json";

type Person = {
  photo?: string;
  name: string;
  title?: string;
  about?: string;
  email?: string;
  phone?: string;
  location?: string;
  role?: string;
  current?: boolean;
};

const resolvePhoto = (name?: string) => {
  if (!name) return undefined;
  const sname = name.replace(/^(Mr\.|Dr\.|Prof\.)\s*/, "");
  const variants = [
    sname.replace(/ /g, "_") + ".jpg",
    sname.replace(/ /g, "_") + ".png",
    sname.replace(/ /g, "_") + ".jpeg",
  ];

  for (const v of variants) {
    try {
      const img = require(`../assets/profiles/${v}`);
      if (img) return img.default || img;
    } catch (e) {}
  }
  return undefined;
};

const allProfiles: Person[] = (profiles as any) || [];

const sponsors = allProfiles.filter((p) => p.role === "Sponsor");
const coaches = allProfiles.filter((p) => p.role === "Coach");
const currentDevs = allProfiles.filter(
  (p) => p.role === "Developer" && p.current !== false
);
const pastDevs = allProfiles.filter(
  (p) => p.role === "Developer" && p.current === false
);

const About: React.FC = () => {
  return (
    <div className="about-page">
      <div className="about-intro">
        <section className="sp-section">
          <h2 className="section-header">Project Sponsor</h2>
          <div className="dev-grid">
            {sponsors.map((s) => (
              <Profile
                key={s.name}
                {...{ ...s, photo: resolvePhoto(s.name) }}
                size="large"
              />
            ))}
          </div>
        </section>

        <section className="about-text">
          <h2 className="section-header">Project Purpose</h2>
          <p>
            JBioFramework (JBF) is an open-source suite of analytical simulations of
            protein structure and function. It provides students with access to
            tools like 1D electrophoresis, 2D electrophoresis, Tandem Mass
            Spectrometry, chemical drawing, and an upcoming simulation of peptide
            separation by Reversed Phase Liquid Chromatography (RPLC).
          </p>
          <p>
            Originally built in Java in 1997, JBF has since been converted into a
            modern web application with a JavaScript front-end and Python back-end.
            It is used in biochemistry, bioinformatics, and chemistry education at
            RIT and beyond.
          </p><br/>
          <h2 className="section-header">Commercial Use</h2>
          <p>
            Use by individual <strong>students and teachers</strong> is{" "}
            <strong>free of charge</strong>. Educational presentations with{" "}
            <strong>fewer than 50 attendees</strong> are also free, while those with{" "}
            <strong>50 to 200 attendees</strong> require a{" "}
            <strong>$100 license fee</strong>. Presentations with{" "}
            <strong>more than 200 attendees</strong> require a{" "}
            <strong>$500 license fee</strong>. <strong>Online publication</strong>{" "}
            requires a <strong>negotiated commercial license</strong>.{" "}
            <strong>Unauthorized use or distribution</strong> constitutes{" "}
            <strong>piracy</strong> and may result in legal action.
          </p>
          <p>
            For any inquiries, please contact Dr. Paul Craig at{" "}
            <a href="mailto:pac8612@rit.edu">pac8612@rit.edu</a>.
          </p>
        </section>
      </div>

      <section className="dev-team">
        <h2 className="section-header">Development Team</h2>
          <div className="dev-grid">
            {coaches.map((c) => (
                <Profile
                  key={c.name}
                  {...{ ...c, photo: resolvePhoto(c.name) }}
                  size="small"
                  about="🎬 Coach"
                />
              ))}
            {currentDevs.map((d) => (
              <Profile
                key={d.name}
                {...{ ...d, photo: resolvePhoto(d.name) }}
                size="small"
                about="⚡ Active Developer"
              />
            ))}
            {pastDevs.map((d) => (
              <Profile
                key={d.name}
                {...{ ...d, photo: resolvePhoto(d.name) }}
                size="small"
                about="↩️ Previous Contributor"
              />
            ))}
          </div>
      </section>
    </div>
  );
};

export default About;
