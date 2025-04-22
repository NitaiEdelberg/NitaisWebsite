import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import Product from './models/product.model.js';

dotenv.config();

const app = express();

app.use(express.json()); // allows to accept JSON data in the req.body

app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json({success: true, data: products});
    } catch (error) {
        console.log("Error in get products", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }

});

app.post("/api/products",async (req, res) => {
    const product = req.body; // data that the user will send

    if(!product.name || !product.price || !product.image) {
        return res.status(400).json({ success:false, message: "Please fill all the fields" });
    }

    const newProduct = new Product(product);

    try {
        await newProduct.save();
        res.status(201).json({success: true, data: newProduct});
    } catch (error) {
        console.error("Error in create product", error.message);
        res.status(500).json({success:false, message:"Server Error"});
    }
});

app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    console.log("id", id);
    try {
        await Product.findByIdAndDelete(id);
        res.status(200).json({success: true, message: "Product deleted successfully"});
    } catch(error) {
        console.log("Error in delete product", error.message);
        res.status(404).json({success:false, message:"product does not exist"});
    }
});

app.put("/api/products/:id", async (req, res) => { 
    const { id } = req.params;

    const product = req.body;

    if(!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success:false, message: "Product does not exist: Invalid Product Id" });
    }    
    try { 
        const updatedProduct = await Product.findByIdAndUpdate(id, product, {new: true});
        res.status(200).json({success: true, data: updatedProduct});
    } catch(error) {
        res.status(500).json({success:false, message:"Server Error"});
    }

});

app.listen(5000, () => {
    connectDB();
    console.log("server started at http://localhost:5000");
})

