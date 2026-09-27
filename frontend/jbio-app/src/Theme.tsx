import { createTheme } from '@mui/material'

let theme = createTheme({
    palette: {
        text: {
            primary: "#ffffff",
            secondary: "#ffffff"
        },
        primary: {
            main: '#00ff00', // #8ea2ff
        },
        secondary: {
            main: '#0000ff' // #555a66
        },
        background: {
            paper: '#880000', // #3a3d46
        },
    },
})

theme = createTheme(
    {
        components: {
            MuiCard: {
                styleOverrides: {
                    root: {
                        border: `2px solid ${theme.palette.primary.main}`,
                    },
                },
            },
            MuiCardHeader: {
                styleOverrides: {
                    root: {
                        paddingBottom: 8,
                    },
                    title: {
                        fontWeight: 700,
                        fontSize: "1.2rem",
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        width: 260
                    }
                }
            },
            MuiSelect: {
                styleOverrides: {
                    root: {
                        width: 260,
                    },
                    icon: {
                        color: "#00aaff"
                    }
                }
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        backgroundColor: theme.palette.background.paper
                    },
                    notchedOutline: {
                        borderColor: theme.palette.secondary.main
                    },
                }
            },
            MuiSlider: {
                styleOverrides: {
                    track: {
                        border: "none",
                    },
                    thumb: {
                        color: "#ffff00"
                    }
                }
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        fontWeight: 600
                    }
                }
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        backgroundColor: "#2f323a"
                    }
                }
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottomWidth: 1,
                        borderColor: "#ff00ff", // #555a66
                    },
                }
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        variants: [
                            {
                                props: { severity: 'error' },
                                style: {
                                    color: "#ff6b6b",
                                    backgroundColor: "#2a1a1a",
                                    border: "1px solid #ff6b6b"
                                }
                            }
                        ]
                    }
                }
            }
        },
    },
    theme,
)

export default theme
