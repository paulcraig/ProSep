import "./Profile.css";
import { Component } from "react";

import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";


type ProfileProps = {
  photo: string;
  name: string;
  title?: string;
  about?: string;
  email?: string;
  phone?: string;
  location?: string;
  size?: "small" | "medium" | "large";
};


type ProfileState = {
  copied: string | null;
  imageError: boolean;
  hovered: string | null;
};

class Profile extends Component<ProfileProps, ProfileState> {
  constructor(props: ProfileProps) {
    super(props);
    this.state = { copied: null, imageError: false, hovered: null };
  }

  copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          this.setState({ copied: label });
          setTimeout(() => this.setState({ copied: null }), 600); // reset bounce quickly
        })
        .catch(() => this.fallbackCopy(text, label));
    } else {
      console.log("Clipboard API failed -> Trying HTTP fallback.");
      this.fallbackCopy(text, label);
    }
  };

  fallbackCopy = (text: string, label: string) => {
    const textarea = document.createElement("textarea");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.value = text;

    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand("copy");
      this.setState({ copied: label });
      setTimeout(() => this.setState({ copied: null }), 600);
    } catch (err) {
      console.log("Fallback copy failed:", err);
    }
    
    document.body.removeChild(textarea);
  };

  handleImageError = () => {
    this.setState({ imageError: true });
  };

  render() {
    const { photo, name, title, about, email, phone, location, size = "medium" } = this.props;
    const { copied, imageError, hovered } = this.state;

    return (
      <div className="profile-wrapper">
        <div className={`profile-card ${size}`}>
          <div className="profile-photo">
            {imageError || !photo ? (
              <div className="photo-placeholder">?</div>
            ) : (
              <img src={photo} alt={name} onError={this.handleImageError} />
            )}
          </div>
          <h2 className="profile-name">{name}</h2>
          {title && <h3 className="profile-title">{title}</h3>}
          <div className="profile-socials">
            {email && (
              <div
                className={`social-icon ${copied === "email" ? "bounce" : ""}`}
                onClick={() => this.copyToClipboard(email, "email")}
                onMouseEnter={() => this.setState({ hovered: "email" })}
                onMouseLeave={() => this.setState({ hovered: null })}
              >
                <EmailIcon />
                {hovered === "email" && <span className="tooltip">{email}</span>}
              </div>
            )}
            {phone && (
              <div
                className={`social-icon ${copied === "phone" ? "bounce" : ""}`}
                onClick={() => this.copyToClipboard(phone, "phone")}
                onMouseEnter={() => this.setState({ hovered: "phone" })}
                onMouseLeave={() => this.setState({ hovered: null })}
              >
                <PhoneIcon />
                {hovered === "phone" && <span className="tooltip">{phone}</span>}
              </div>
            )}
            {location && (
              <div
                className={`social-icon ${copied === "location" ? "bounce" : ""}`}
                onClick={() => this.copyToClipboard(location, "location")}
                onMouseEnter={() => this.setState({ hovered: "location" })}
                onMouseLeave={() => this.setState({ hovered: null })}
              >
                <LocationOnIcon />
                {hovered === "location" && <span className="tooltip">{location}</span>}
              </div>
            )}
          </div>
          {about && <p className="profile-about">{about}</p>}
        </div>
      </div>
    );
  }
}

export default Profile;
