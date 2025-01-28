import './Instructions.css';

function Instructions() {
    return (
        <div>
            <div className="navbar">
                <a href="#1de"><h2 className="navbar-header" data-testId = '1de-nav'>1DE</h2></a>
                <a href="#2de"><h2 className="navbar-header" data-testId = '2de-nav'>2DE</h2></a>
                <a href="#3de"><h2 className="navbar-header" data-testId = '3de-nav'>3DE</h2></a>
            </div>
            <h1 className="page-header">Instructions</h1>
            <h2 className="section-header" id="1de" data-testId = '1de-header'>One-Dimensional Gel Electrophoresis</h2>
            <p>
                The following are step by step instructions on how to use the 1-D electrophoresis program
            </p>
            <ol>
                <li>Select the number of wells</li>
                <li>Select the proteins you want to test</li>
                <li>Select an Acrylamide percentage</li>
                <li>Select the standards you want present</li>
                <li>Select a voltage</li>
                <li>Press the Add Sample button</li>
                <li>Press the Start Run button</li>
            </ol>
            <p>
                For cases with multiple samples, make sure to add all samples to each well.
                You may also click on each of the strands in order to learn more about that protein.
            </p>
            <h2 className="section-header" id="2de" data-testId="2de-header">Two-Dimensional Gel Electrophoresis</h2>
            <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse consectetur massa sed ex volutpat, et pretium
                erat laoreet. Nam quis nulla at nisi semper cursus. Quisque interdum lacus fermentum ultricies
                tincidunt. Vestibulum luctus fringilla enim, eu elementum est iaculis vel. Nulla urna nulla, rutrum in
                ante id, gravida ullamcorper nisl. Integer sed aliquet nibh. Nulla tristique lacus ex, ac euismod neque
                scelerisque et. Maecenas non nisi pellentesque, consectetur ante ac, dignissim massa. Phasellus
                eleifend, augue at cursus scelerisque, est diam lacinia neque, nec laoreet neque mi a neque. Praesent
                non bibendum risus. Nunc tristique massa eget mi venenatis, a sagittis mi imperdiet.
            </p>

            <h2 className="section-header" id="3de" data-testId = '3de-header'>Three-Dimensional Gel Electrophoresis</h2>
            <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse consectetur massa sed ex volutpat, et pretium
                erat laoreet. Nam quis nulla at nisi semper cursus. Quisque interdum lacus fermentum ultricies
                tincidunt. Vestibulum luctus fringilla enim, eu elementum est iaculis vel. Nulla urna nulla, rutrum in
                ante id, gravida ullamcorper nisl. Integer sed aliquet nibh. Nulla tristique lacus ex, ac euismod neque
                scelerisque et. Maecenas non nisi pellentesque, consectetur ante ac, dignissim massa. Phasellus
                eleifend, augue at cursus scelerisque, est diam lacinia neque, nec laoreet neque mi a neque. Praesent
                non bibendum risus. Nunc tristique massa eget mi venenatis, a sagittis mi imperdiet.
            </p>
            <img src="https://www.future-science.com/cms/10.2144/000112421/asset/images/medium/figure2.jpg" alt="3de" style={{width: 400 +"px"}} />
            <ol>
                <li>tincidunt. Vestibulum luctus fringilla enim, eu elementum</li>
                <li>est iaculis vel. Nulla urna nulla, rutrum in</li>
                <li>ante id, gravida</li>
                <li>ullamcorper nisl. Integer sed aliquet nibh. Nulla tristique lacus ex, ac euismod neque</li>
            </ol>
        </div>
    );
}

export default Instructions;
