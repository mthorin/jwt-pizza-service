const config = require('./config.js');
const os = require('os');

class Metrics{
    constructor() {
        this.totalPostRequest = 0;
        this.totalGetRequest = 0;
        this.totalDeleteRequest = 0;
        this.totalPutRequest = 0;
        this.totalRequest = 0

        this.totalAuthSuccess = 0;
        this.totalAuthFail = 0;

        this.activeUsers = 0;

        this.totalLatency = 0;

        //pizza
        this.totalPizza = 0;
        this.pizzaLatency = 0;
        this.totalRevenue = 0;
        this.totalPizzaSuccess = 0;
        this.totalPizzaFailure = 0;

        this.requestTracker = this.requestTracker.bind(this);

        this.sendMetricsPeriodically(10000);
    }
    // ----- Request Tracker -----
    requestTracker(req, res, next) {
        this.totalRequest++;
        if (req.method == "POST") this.totalPostRequest++;
        if (req.method == "GET") this.totalGetRequest++;
        if (req.method == "DELETE") this.totalDeleteRequest++;
        if (req.method == "PUT") this.totalPutRequest++;

        const startTime = Date.now();

        // Track response time and status
        res.on('finish', () => {
            const elapsedTime = Date.now() - startTime;
            this.totalLatency += elapsedTime;

            // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${elapsedTime}ms`);
            // Pizza
            if (req.originalUrl == '/api/order') {
                if (req.method == 'POST'){
                    if (res.statusCode == 200) {
                        this.totalPizzaSuccess++;
                        res.req.body.items.forEach(item => {
                            this.totalPizza++;
                            this.totalRevenue += item.price;
                        });
                    }

                    if (res.statusCode == 500) {
                        this.totalPizzaFailure++;
                    }
                }
            }

            // Authentication
            if (req.originalUrl == '/api/auth') {
                if (req.method == 'PUT'){
                    if (res.statusCode == 200) {
                        this.totalAuthSuccess++;
                        this.activeUsers++;
                    }
                    else this.totalAuthFail++;
                }
                if (req.method == 'DELETE'){
                    if (res.statusCode == 200) {
                        this.totalAuthSuccess++;
                        this.activeUsers--;
                    }
                    else this.totalAuthFail++;
                }
            }
        });

        next();
    }

    logFactoryCall(latency) {
        this.pizzaLatency += latency;
    }
    
    // ----- Helper Functions -----
    nowString() {
        return (Math.floor(Date.now()) * 1000000).toString();
    }

    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return cpuUsage.toFixed(2) * 100;
    }
    
    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        return memoryUsage.toFixed(2);
    }

    createMetric(metricPrefix, metricName, metricValue){
        return `${metricPrefix},source=${config.metrics.source} ${metricName}=${metricValue}`
    }

    createHTTPMetric(metricPrefix, httpMethod, metricName, metricValue){
        return `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`
    }

    // ----- Metric Builders -----
    httpMetrics(buf) {
        // HTTP requests by method
        const totalMetric = this.createHTTPMetric('request', 'all', 'total', this.totalRequest);
        buf.add(totalMetric);

        const getMetric = this.createHTTPMetric('request', 'get', 'total', this.totalGetRequest);
        buf.add(getMetric);

        const postMetric = this.createHTTPMetric('request', 'post', 'total', this.totalPostRequest);
        buf.add(postMetric);

        const putMetric = this.createHTTPMetric('request', 'put', 'total', this.totalPutRequest);
        buf.add(putMetric);

        const deleteMetric = this.createHTTPMetric('request', 'delete', 'total', this.totalDeleteRequest);
        buf.add(deleteMetric);

        const latencyMetric = this.createMetric('request', 'latency', this.totalLatency);
        buf.add(latencyMetric);
    }

    systemMetrics(buf) {
        // CPU usage percentage
        const cpuUsageMetric = this.createMetric('system', 'cpu', this.getCpuUsagePercentage())
        buf.add(cpuUsageMetric);

        // Memory usage percentage
        const memoryUsageMetric = this.createMetric('system', 'memory', this.getMemoryUsagePercentage())
        buf.add(memoryUsageMetric);
    }

    userMetrics(buf) {
        // Active users
        const userMetric = this.createMetric('user', 'active', this.activeUsers);
        buf.add(userMetric);
    }

    purchaseMetrics(buf) {
        // Pizzas
        //  Sold
        const soldMetric = this.createMetric('purchase', 'sold', this.totalPizza);
        buf.add(soldMetric);

        //  Revenue
        const revenueMetric = this.createMetric('purchase', 'revenue', this.totalRevenue);
        buf.add(revenueMetric);

        //  Creation latency
        const latencyMetric = this.createMetric('purchase', 'latency', this.pizzaLatency);
        buf.add(latencyMetric);

        //  Creation success
        const successMetric = this.createMetric('purchase', 'success', this.totalPizzaSuccess);
        buf.add(successMetric);

        //  Creation failures
        const failureMetric = this.createMetric('purchase', 'failure', this.totalPizzaFailure);
        buf.add(failureMetric);

    }

    authMetrics(buf) {
        // Authentication attempts
        //  Successful
        const authSuccessMetric = this.createMetric('auth', 'success', this.totalAuthSuccess);
        buf.add(authSuccessMetric);

        //  Failed
        const authFailMetric = this.createMetric('auth', 'fail', this.totalAuthFail);
        buf.add(authFailMetric);
    }
    
    sendMetricToGrafana(metrics) {
        console.log(metrics);
    
        fetch(`${config.metrics.url}`, {
            method: 'post',
            body: metrics,
            headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
        }).catch((error) => {
            console.error('Error pushing metrics:', error);
        });
    }
    
    sendMetricsPeriodically(period) {
        setInterval(() => {
            try {
                const buf = new MetricBuilder();
                this.httpMetrics(buf);
                this.systemMetrics(buf);
                this.userMetrics(buf);
                this.purchaseMetrics(buf);
                this.authMetrics(buf);
        
                const metrics = buf.toString('\n');
                this.sendMetricToGrafana(metrics);
            } catch (error) {
                console.log('Error sending metrics', error);
            }
        }, period);
    }
}

class MetricBuilder{
    constructor() {
        this.metrics = [];
    }

    toString(delimiter) {
        return this.metrics.join(delimiter);
    }

    add(metric) {
        this.metrics.push(metric);
    }
}

const metrics = new Metrics();
module.exports = metrics;