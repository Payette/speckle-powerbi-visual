# Speckle Power BI Visual
Power BI Custom Visual that displays a 3D view of a Speckle Stream.

# Developer Setup

    npm install
    npm run package

This will create a self contained Power BI visual at `dist/#######.pbiviz`. From PowerBI go to `Home | More visuals | From my files` then select this `pbiviz` file. Anytime you make changes run `npm package` again and re load in Power BI.

This workflow will work on both Power BI Desktop and Online

# Hot-reload with Power BI Online
Power BI Online supports a slightly quicker workflow (this will not work with Power BI Desktop). Basically, you start a webserver from your repo, then Power BI Online grabs the latest visual from that webserver.

## Setup a local Certificate
Follow instructions here https://docs.microsoft.com/en-us/power-bi/developer/visuals/custom-visual-develop-tutorial#setting-up-the-developer-environment to install a root certificate on your local machine. This will allow you to run a server at https://localhost:8080

Then run

    npm install
    npm start

## Enable Developer Visual
Follow the instructions here https://docs.microsoft.com/en-us/power-bi/developer/visuals/custom-visual-develop-tutorial#setting-up-the-developer-environment to enable the Developer Visual.

Once you have added the Developer Visual to a report you can click the `Auto Reload` button above the visual. Now anytime you make changes to your code the visual will automatically reload.

