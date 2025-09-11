import * as profiles from './about_images';
import './About.css';

function About() {
  return (
    <div>
      {/* Top navigation */}
      <nav className="navbar">
        <a href="#project-purpose"><h2 className="navbar-header">Project Purpose</h2></a>
        <a href="#commercial-use"><h2 className="navbar-header">Commercial Use</h2></a>
        <a href="#project-owner"><h2 className="navbar-header">Project Owner</h2></a>
        <a href="#current-developers"><h2 className="navbar-header">Current Developers</h2></a>
        <a href="#historic-developers"><h2 className="navbar-header">Historic Developers</h2></a>
      </nav>

      {/* About: Owner | Purpose/Commercial */}
      <div className="about-wrapper">
        <aside className="about-left">
          <h2 className="section-header" id="project-owner" style={{textAlign:'left'}}>Project Owner</h2>
          <div className="owner-card">
            <img className="profile-icon" src={profiles.paul} alt="Paul Craig" />
            <figcaption className="profile-title">Paul Craig</figcaption>
            <p>
              Dr. Paul Craig received his B.S. in Chemistry from Oral Roberts University in 1979,
              and his Ph.D. in Biological Chemistry from The University of Michigan in 1985.
              Following a post-doc at Henry Ford Hospital (biophysical chemistry of blood clotting;
              1985-1988), he spent five years as an analytical biochemist at BioQuant, Inc.,
              in Ann Arbor, Michigan before joining RIT in 1993.
            </p>
          </div>
        </aside>

        <section className="about-right">
          <div className="purpose">
            <h2 className="section-header" id="project-purpose">Project Purpose</h2>
            <p>
              JBioFramework (JBF) is a set of chemical simulations frequently used in chemistry,
              biochemistry, and proteomics research. Its main purpose is to allow for simplified
              simulation of proteins for academic and research opportunities. It is owned and operated
              by the RIT College of Science under the watch of Paul Craig. It is continuously being
              worked on with collaboration between the RIT College of Science and the RIT Software
              Engineering Department.
            </p>
          </div>

          <div className="commercial">
            <h2 className="section-header" id="commercial-use">Commercial Use</h2>
            <ul>
              <li>Students and teachers: Free</li>
              <li>Under 50 audience members: Free</li>
              <li>50–200 audience members: $100</li>
              <li>Over 200 audience members: $500</li>
              <li>Publish online: $100000000</li>
              <li title="Except for most of the time">Piracy is not a victimless crime</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Developers */}
      <DeveloperSection
        id="current-developers"
        title="Current Developers"
        members={[
          { src: profiles.zach, name: 'Zachary Van Horn', role: 'Project Leader' },
          { src: profiles.placeholder, name: 'Luke Knofczynski', role: 'Technical Lead' },
          { src: profiles.shreyes, name: 'Shreyes Gadwalkar', role: 'Head of Communications' },
          { src: profiles.placeholder, name: 'Aditya Vikram', role: 'Scrum Master' },
          { src: profiles.placeholder, name: 'Jacob Fay', role: 'Testing Lead' },
        ]}
      />

      <DeveloperSection
        id="historic-developers"
        title="Historic Developers"
        members={[
          { src: profiles.landon, name: 'Landon Heatly', role: 'Project Leader' },
          { src: profiles.amr, name: 'Amr Mualla', role: 'Technical Lead' },
          { src: profiles.beck, name: 'Beck Anderson', role: 'Head of Communications' },
          { src: profiles.mack, name: 'Mack Leonard', role: 'Scrum Master' },
          { src: profiles.chase, name: 'Chase Amador', role: 'Testing Lead' },
        ]}
        historic
      />
    </div>
  );
}

function DeveloperSection({ id, title, members, historic = false }) {
  return (
    <section className="dev-section" id={id}>
      <h2 className="section-header">{title}</h2>
      <div className={historic ? 'historic-grid' : 'grid-container'}>
        {members.map((m) => (
          <div key={m.name} className={historic ? 'historic-grid-item' : 'grid-item'}>
            <img className={historic ? 'historic-icon' : 'profile-icon'} src={m.src} alt={`${m.name}-pic`} />
            <figcaption className={historic ? 'historic-title' : 'profile-title'}>{m.name}</figcaption>
            <p>{m.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default About;
