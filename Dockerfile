# Use an official Node.js runtime as a parent image
FROM node:22:2.0

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install PM2 globally and other dependencies
RUN npm install pm2 -g && npm install

# Copy the rest of the application code
COPY . .

# Expose any necessary ports
EXPOSE 3000

# Start the application using PM2
CMD ["pm2-runtime", "index.js"]
