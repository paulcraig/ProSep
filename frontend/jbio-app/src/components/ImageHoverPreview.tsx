import { RemoveRedEye } from "@mui/icons-material";
import {
  CircularProgress,
  IconButton,
  Popper,
  Paper,
} from "@mui/material";
import { useState } from "react";

type ImageHoverPreviewProps = {
  url: string;
};

export const ImageHoverPreview = ({ url }: ImageHoverPreviewProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);

  const open = Boolean(anchorEl);

  return (
    <>
      <span
        onMouseEnter={(e) => {
          setAnchorEl(e.currentTarget);
          setLoading(true);
        }}
        onMouseLeave={() => setAnchorEl(null)}
        style={{ display: "inline-flex" }}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ textDecoration: "none" }}
        >
          <IconButton sx={{ color: "var(--text)" }}>
            <RemoveRedEye />
          </IconButton>
        </a>
      </span>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-end"
        modifiers={[
          {
            name: "offset",
            options: {
              offset: [0, 8],
            },
          },
        ]}
        style={{ zIndex: 1300 }}
      >
        <Paper
          elevation={6}
          sx={{
            width: 200,
            p: 1,
            borderRadius: 2,
          }}
        >
          {loading && (
            <div
              style={{
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={24} />
            </div>
          )}

          <img
            src={url}
            alt="Peptide preview"
            width={200}
            style={{
              display: loading ? "none" : "block",
            }}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </Paper>
      </Popper>
    </>
  );
};
